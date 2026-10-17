/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { pushSnipe } from '../lib/snipe.js';

export default {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage, meta) {
    if (!newMessage?.guildId) return;

    const authorId = newMessage.author?.id ?? oldMessage.author?.id ?? null;
    if (!authorId || authorId === meta?.client?.user?.id) return;

    const oldContent = oldMessage.content ?? '';
    const newContent = newMessage.content ?? '';
    if (oldContent === newContent) return;

    await pushSnipe(newMessage.channelId, {
      kind: 'duzenleme',
      id: newMessage.id,
      authorId,
      authorTag: newMessage.author?.username ?? null,
      oldContent,
      content: newContent,
      hadAttachments: Boolean(newMessage.attachments?.size),
    }).catch(() => {});
  },
};
