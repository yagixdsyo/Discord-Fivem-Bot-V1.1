/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';

export default {
  name: 'emojiUpdate',
  async execute(oldEmoji, newEmoji, meta) {
    const guild = newEmoji?.guild;
    if (!guild) return;
    if (oldEmoji?.name === newEmoji.name) return;

    const { ok } = await guardGate(guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(guild.id);
    if (!config.modules.emoji.enabled) return;

    const actorResult = await judgeActor({
      guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'emoji',
      auditType: AuditLogEvent.EmojiUpdate,
      targetId: newEmoji.id,
      force: true,
    });

    await handleViolation({
      guild,
      client: meta?.client,
      config,
      moduleKey: 'emoji',
      type: 'emoji_update',
      description: `Emoji adı değişti: \`:${oldEmoji.name}:\` → \`:${newEmoji.name}:\``,
      target: `:${newEmoji.name}:`,
      actorResult,
      restoreFn: async () => {
        try {
          await newEmoji.setName(oldEmoji.name, 'Guard: emoji adı geri alındı');
          return { ok: true, target: `:${oldEmoji.name}:` };
        } catch (err) {
          return { ok: false, error: err?.message ?? 'geri_alınamadı' };
        }
      },
    });
  },
};
