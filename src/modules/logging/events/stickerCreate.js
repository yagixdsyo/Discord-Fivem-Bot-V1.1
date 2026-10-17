/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { findAuditActor, AuditLogEvent } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'stickerCreate',
  async execute(sticker) {
    if (!sticker?.guild) return;
    const actor = await findAuditActor(sticker.guild, AuditLogEvent.StickerCreate, sticker.id, {
      important: false,
    });
    await emitLog(sticker.guild, 'log_sticker', {
      actor: actor?.actorId ?? null,
      actorTag: actor?.actorTag ?? null,
      lines: [`Yeni sticker: \`${sticker.name}\``],
      ids: [['Sticker', sticker.id]],
    });
  },
};
