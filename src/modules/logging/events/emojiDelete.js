/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { findAuditActor, AuditLogEvent } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'emojiDelete',
  async execute(emoji) {
    if (!emoji?.guild) return;
    const actor = await findAuditActor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id, {
      important: false,
    });
    await emitLog(emoji.guild, 'log_emoji', {
      actor: actor?.actorId ?? null,
      actorTag: actor?.actorTag ?? null,
      lines: [`Emoji silindi: \`${emoji.name}\``],
      ids: [['Emoji', emoji.id]],
    });
  },
};
