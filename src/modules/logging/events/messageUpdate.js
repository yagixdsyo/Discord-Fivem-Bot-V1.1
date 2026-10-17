/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCachedMessage, rememberMessage } from '../lib/cache.js';
import { emitLog } from '../lib/emit.js';

function truncate(value, limit = 400) {
  const str = String(value ?? '');
  return str.length > limit ? `${str.slice(0, limit - 3)}...` : str;
}

export default {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (!newMessage?.guild || newMessage.author?.bot) {
      if (newMessage?.guild && newMessage.author) rememberMessage(newMessage);
      return;
    }

    const before = getCachedMessage(newMessage.channelId, newMessage.id)?.content ?? oldMessage.content ?? null;
    const after = newMessage.content ?? null;
    rememberMessage(newMessage);

    if (before === null || after === null || before === after) return;
    if (before === '' && after === '') return;

    const link = `https://discord.com/channels/${newMessage.guild.id}/${newMessage.channelId}/${newMessage.id}`;
    await emitLog(newMessage.guild, 'log_mesaj_duzenleme', {
      target: newMessage.author?.id ?? null,
      targetTag: newMessage.author?.username ?? null,
      lines: [
        `Kanal: <#${newMessage.channelId}> ([mesaja git](${link}))`,
        `Eski: \`${truncate(before) || '(boş)'}\``,
        `Yeni: \`${truncate(after) || '(boş)'}\``,
      ],
      ids: [['Mesaj', newMessage.id]],
    });
  },
};
