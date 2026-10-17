/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';

export default {
  name: 'emojiCreate',
  async execute(emoji, meta) {
    const guild = emoji?.guild;
    if (!guild) return;

    const { ok } = await guardGate(guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(guild.id);
    if (!config.modules.emoji.enabled) return;

    const actorResult = await judgeActor({
      guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'emoji',
      auditType: AuditLogEvent.EmojiCreate,
      targetId: emoji.id,
      force: true,
    });

    await handleViolation({
      guild,
      client: meta?.client,
      config,
      moduleKey: 'emoji',
      type: 'emoji_create',
      description: `Emoji oluşturuldu: \`:${emoji.name}:\``,
      target: `:${emoji.name}:`,
      actorResult,
      restoreFn: async () => {
        try {
          await emoji.delete('Guard: yetkisiz emoji oluşturma');
          return { ok: true, target: `:${emoji.name}:` };
        } catch (err) {
          return { ok: false, error: err?.message ?? 'silinemedi' };
        }
      },
    });
  },
};
