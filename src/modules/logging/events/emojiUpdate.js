/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { findAuditActor, AuditLogEvent } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'emojiUpdate',
  async execute(oldEmoji, newEmoji) {
    if (!newEmoji?.guild) return;
    const lines = [];
    if (oldEmoji.name !== newEmoji.name) {
      lines.push(`İsim: \`${oldEmoji.name}\` -> \`${newEmoji.name}\``);
    }
    if (lines.length === 0) return;
    const actor = await findAuditActor(newEmoji.guild, AuditLogEvent.EmojiUpdate, newEmoji.id, {
      important: false,
    });
    await emitLog(newEmoji.guild, 'log_emoji', {
      actor: actor?.actorId ?? null,
      actorTag: actor?.actorTag ?? null,
      lines,
      ids: [['Emoji', newEmoji.id]],
    });
  },
};
