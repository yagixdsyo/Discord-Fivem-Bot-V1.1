/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { findAuditActor, AuditLogEvent } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'stickerUpdate',
  async execute(oldSticker, newSticker) {
    if (!newSticker?.guild) return;
    const lines = [];
    if (oldSticker.name !== newSticker.name) {
      lines.push(`İsim: \`${oldSticker.name}\` -> \`${newSticker.name}\``);
    }
    if (oldSticker.description !== newSticker.description) lines.push('Açıklama güncellendi');
    if (lines.length === 0) return;

    const actor = await findAuditActor(newSticker.guild, AuditLogEvent.StickerUpdate, newSticker.id, {
      important: false,
    });
    await emitLog(newSticker.guild, 'log_sticker', {
      actor: actor?.actorId ?? null,
      actorTag: actor?.actorTag ?? null,
      lines,
      ids: [['Sticker', newSticker.id]],
    });
  },
};
