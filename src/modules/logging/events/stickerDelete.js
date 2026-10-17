/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { findAuditActor, AuditLogEvent } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'stickerDelete',
  async execute(sticker) {
    if (!sticker?.guild) return;
    const actor = await findAuditActor(sticker.guild, AuditLogEvent.StickerDelete, sticker.id, {
      important: false,
    });
    await emitLog(sticker.guild, 'log_sticker', {
      actor: actor?.actorId ?? null,
      actorTag: actor?.actorTag ?? null,
      lines: [`Sticker silindi: \`${sticker.name}\``],
      ids: [['Sticker', sticker.id]],
    });
  },
};
