/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCachedMessage } from '../../logging/lib/cache.js';
import { pushSnipe } from '../lib/snipe.js';

export default {
  name: 'messageDelete',
  async execute(message, meta) {
    if (!message?.guildId) return;

    const cached = getCachedMessage(message.channelId, message.id);
    const authorId = message.author?.id ?? cached?.authorId ?? null;
    if (!authorId || authorId === meta?.client?.user?.id) return;

    const content = (message.content ?? '') || cached?.content || '';
    await pushSnipe(message.channelId, {
      kind: 'silme',
      id: message.id,
      authorId,
      authorTag: message.author?.username ?? cached?.authorTag ?? null,
      content,
      hadAttachments: Boolean(message.attachments?.size),
    }).catch(() => {});
  },
};
