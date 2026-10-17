/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';

export default {
  name: 'stickerUpdate',
  async execute(oldSticker, newSticker, meta) {
    const guild = newSticker?.guild;
    if (!guild) return;
    if (oldSticker?.name === newSticker.name && oldSticker?.description === newSticker.description) return;

    const { ok } = await guardGate(guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(guild.id);
    if (!config.modules.emoji.enabled) return;

    const actorResult = await judgeActor({
      guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'emoji',
      auditType: AuditLogEvent.StickerUpdate,
      targetId: newSticker.id,
      force: true,
    });

    await handleViolation({
      guild,
      client: meta?.client,
      config,
      moduleKey: 'emoji',
      type: 'sticker_update',
      description: `Sticker değişti: **${oldSticker.name}** → **${newSticker.name}**`,
      target: newSticker.name,
      actorResult,
      restoreFn: async () => {
        try {
          await newSticker.edit({ name: oldSticker.name, description: oldSticker.description ?? null, reason: 'Guard: sticker geri alındı' });
          return { ok: true, target: oldSticker.name };
        } catch (err) {
          return { ok: false, error: err?.message ?? 'geri_alınamadı' };
        }
      },
    });
  },
};
