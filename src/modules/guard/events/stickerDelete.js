/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';
import { restoreSticker, stickerSnapshot } from '../lib/restore.js';

export default {
  name: 'stickerDelete',
  async execute(sticker, meta) {
    const guild = sticker?.guild;
    if (!guild) return;

    const { ok } = await guardGate(guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(guild.id);
    if (!config.modules.emoji.enabled) return;

    const snapshot = stickerSnapshot(sticker);
    const actorResult = await judgeActor({
      guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'emoji',
      auditType: AuditLogEvent.StickerDelete,
      targetId: sticker.id,
      force: true,
    });

    await handleViolation({
      guild,
      client: meta?.client,
      config,
      moduleKey: 'emoji',
      type: 'sticker_delete',
      description: `Sticker silindi: **${snapshot.name}**`,
      target: snapshot.name,
      actorResult,
      restoreFn: async () => {
        const restored = await restoreSticker(guild, snapshot);
        return restored
          ? { ok: true, target: snapshot.name, newId: restored.id }
          : { ok: false, error: 'sticker geri yüklenemedi (dosya kaynağı erişilemez)' };
      },
    });
  },
};
