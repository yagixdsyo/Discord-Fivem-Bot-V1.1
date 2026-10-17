/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';
import { emojiSnapshot, restoreEmoji } from '../lib/restore.js';

export default {
  name: 'emojiDelete',
  async execute(emoji, meta) {
    const guild = emoji?.guild;
    if (!guild) return;

    const { ok } = await guardGate(guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(guild.id);
    if (!config.modules.emoji.enabled) return;

    const snapshot = emojiSnapshot(emoji);
    const actorResult = await judgeActor({
      guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'emoji',
      auditType: AuditLogEvent.EmojiDelete,
      targetId: emoji.id,
      force: true,
    });

    await handleViolation({
      guild,
      client: meta?.client,
      config,
      moduleKey: 'emoji',
      type: 'emoji_delete',
      description: `Emoji silindi: \`:${snapshot.name}:\``,
      target: `:${snapshot.name}:`,
      actorResult,
      restoreFn: async () => {
        const restored = await restoreEmoji(guild, snapshot);
        return restored
          ? { ok: true, target: `:${snapshot.name}:`, newId: restored.id }
          : { ok: false, error: 'emoji geri yüklenemedi' };
      },
    });
  },
};
