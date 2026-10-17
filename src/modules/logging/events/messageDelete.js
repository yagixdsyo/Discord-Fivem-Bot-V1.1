/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCachedMessage, forgetMessage, pushSnipe } from '../lib/cache.js';
import { emitLog } from '../lib/emit.js';
import { handleProtectedDelete } from '../lib/protection.js';

function truncate(value, limit = 400) {
  const str = String(value ?? '');
  return str.length > limit ? `${str.slice(0, limit - 3)}...` : str;
}

export default {
  name: 'messageDelete',
  async execute(message, meta) {
    if (!message?.guildId) return;
    const client = meta?.client ?? null;

    // Botun kendi mesaji: log kanaliysa koruma devreye girer, digerleri loglanmaz
    if (message.author?.id && client?.user && message.author.id === client.user.id) {
      if (message.guild) await handleProtectedDelete(message, { client });
      return;
    }
    if (message.author?.bot) return;

    const cached = getCachedMessage(message.channelId, message.id);
    forgetMessage(message.channelId, message.id);

    const content = message.content ?? cached?.content ?? '';
    const hadAttachments = Boolean(message.attachments?.size) || cached?.hadAttachments;
    const authorId = message.author?.id ?? cached?.authorId ?? null;
    const authorTag = message.author?.username ?? cached?.authorTag ?? null;

    if (authorId) {
      pushSnipe(message.channelId, {
        authorId,
        authorTag,
        content,
        hadAttachments,
        at: message.createdTimestamp ?? Date.now(),
      });
    }

    const lines = [`Kanal: <#${message.channelId}>`];
    if (content) lines.push(`\`${truncate(content)}\``);
    else lines.push('-');
    if (hadAttachments) lines.push('Dosya eki vardı');

    await emitLog(message.guild ?? { id: message.guildId }, 'log_mesaj_silme', {
      target: authorId,
      targetTag: authorTag,
      lines,
      ids: [['Mesaj', message.id]],
    });
  },
};
