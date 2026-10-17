/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { collectCachedMessages } from '../lib/cache.js';
import { emitLog } from '../lib/emit.js';
import { renderTranscriptHtml } from '../lib/transcript.js';

export default {
  name: 'messageDeleteBulk',
  async execute(messages, channel) {
    const guild = channel?.guild ?? null;
    if (!guild || !channel?.id) return;

    const ids = [...messages.keys()];
    const cached = collectCachedMessages(channel.id, ids);

    const rendered = ids.map((id) => {
      const live = messages.get(id);
      const fallback = cached.find((m) => m.id === id) ?? null;
      return {
        id,
        authorTag: live?.author?.username ?? fallback?.authorTag ?? 'bilinmiyor',
        content: live?.content ?? fallback?.content ?? '',
        at: live?.createdTimestamp ?? fallback?.at ?? Date.now(),
        hadAttachments: Boolean(live?.attachments?.size) || Boolean(fallback?.hadAttachments),
      };
    });

    const html = renderTranscriptHtml({
      guildName: guild.name ?? 'Sunucu',
      channelName: channel.name ?? channel.id,
      messages: rendered,
    });
    const attachment = new AttachmentBuilder(Buffer.from(html, 'utf8'), {
      name: `toplu-silme-${channel.id}-${Date.now()}.html`,
    });

    const authors = [...new Set(rendered.map((m) => m.authorTag))].slice(0, 5);
    await emitLog(guild, 'log_toplu_silme', {
      lines: [
        `Kanal: <#${channel.id}>`,
        `Silinen: **${ids.length}** mesaj`,
        authors.length > 0 ? `Gönderenler: ${authors.join(', ')}` : null,
      ].filter(Boolean),
      files: [attachment],
      ids: [['Kanal', channel.id]],
    });
  },
};
