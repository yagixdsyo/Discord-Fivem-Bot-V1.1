/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';

export default {
  name: 'stickerCreate',
  async execute(sticker, meta) {
    const guild = sticker?.guild;
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
      auditType: AuditLogEvent.StickerCreate,
      targetId: sticker.id,
      force: true,
    });

    await handleViolation({
      guild,
      client: meta?.client,
      config,
      moduleKey: 'emoji',
      type: 'sticker_create',
      description: `Sticker oluşturuldu: **${sticker.name}**`,
      target: sticker.name,
      actorResult,
      restoreFn: async () => {
        try {
          await sticker.delete('Guard: yetkisiz sticker oluşturma');
          return { ok: true, target: sticker.name };
        } catch (err) {
          return { ok: false, error: err?.message ?? 'silinemedi' };
        }
      },
    });
  },
};
