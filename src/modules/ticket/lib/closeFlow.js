/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { buildTranscriptHtml, collectForDelete, uploadTranscript } from '../../moderation/lib/transcript.js';
import { card } from '../../../ui/templates/index.js';
import { button, row } from '../../../ui/v2.js';

const DELETE_DELAY_MS = 6000;

export async function finalizeTicketClose({ guild, client, doc, by, reason, t }) {
  const channel =
    guild.channels.cache.get(doc.channel_id) ?? (await guild.channels.fetch(doc.channel_id).catch(() => null));

  // 1) Transcript
  let html = null;
  let messageCount = 0;
  if (channel) {
    const collected = await collectForDelete(channel, 100).catch(() => ({ messages: [] }));
    messageCount = collected.messages.length;
    html = buildTranscriptHtml({ guildName: guild.name, channelName: channel.name, messages: collected.messages });
  }
  const transcriptLink = html
    ? await uploadTranscript(html, `ticket-${doc.ticket_id}`).catch(() => null)
    : null;

  // 2) Kaydi kapat
  const { closeTicket } = await import('./tickets.js');
  const closed = await closeTicket({ guildId: guild.id, ticketId: doc.ticket_id, by, reason });
  if (!closed.ok && closed.error !== 'zaten_kapali') return { ok: false, error: closed.error };

  // 3) Transcript log kanali
  let logChannelId = null;
  if (html) {
    const { getChannelId } = await import('../../fivem/lib/maps.js');
    const logId =
      (await getChannelId(guild.id, 'log_ticket_transcript').catch(() => null)) ??
      (await getChannelId(guild.id, 'log_ticket').catch(() => null));
    if (logId) {
      const logCh = guild.channels.cache.get(logId) ?? (await guild.channels.fetch(logId).catch(() => null));
      if (logCh) {
        logChannelId = logId;
        const files = [new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `ticket-${doc.ticket_id}.html` })];
        await logCh
          .send(
            card({
              emojiKey: 'TRANSCRIPT',
              title: t('ticket.log_close_title'),
              lines: [
                t('ticket.log_close_line', {
                  kod: `\`${doc.ticket_id}\``,
                  kanal: channel ? `#${channel.name}` : `#${doc.channel_id}`,
                  sahip: `<@${doc.user_id}>`,
                  kapatan: `<@${by}>`,
                }),
                t('ticket.log_close_category', { kategori: t(`ticket.category.${doc.category}`) }),
                t('ticket.log_close_count', { adet: `**${messageCount}**` }),
                t('ticket.log_close_file'),
                transcriptLink ? t('ticket.log_close_link', { link: transcriptLink }) : null,
              ].filter(Boolean),
              accent: 'warn',
              files,
            }),
          )
          .catch(() => {});
      }
    }
  }

  // 4) Kanal: kilitle, banner, gecikmeli sil
  if (channel) {
    await channel.permissionOverwrites.edit(doc.user_id, { SendMessages: false, ViewChannel: false }).catch(() => {});
    await channel
      .send(
        card({
          emojiKey: 'KILIT',
          title: t('ticket.closed_banner_title'),
          lines: [t('ticket.closed_banner'), t('ticket.closed_delete')],
          accent: 'warn',
        }),
      )
      .catch(() => {});
    setTimeout(() => {
      channel.delete(t('ticket.closed_delete_reason')).catch(() => {});
    }, DELETE_DELAY_MS);
  }

  // 5) DM puanlama
  try {
    const user = await client?.users?.fetch(doc.user_id).catch(() => null);
    if (user) {
      const rating = card({
        emojiKey: 'TICKET',
        title: t('ticket.rating_title'),
        lines: [t('ticket.rating_prompt', { sunucu: guild.name })],
        accent: 'info',
        buttons: [
          row([1, 2, 3, 4, 5].map((n) => button({ id: `ticket:puan:${doc.ticket_id}:${n}`, label: `${n}`, style: 'secondary' }))),
        ],
      });
      await user.send(rating).catch(() => {});
    }
  } catch {}

  // 6) Yetkili terfi puani: claim eden (yoksa kapatan) yetkiliye puan.
  let staffPoints = null;
  try {
    const { awardTicketPoints } = await import('../../terfi/lib/staff.js');
    staffPoints = await awardTicketPoints({ guild, ticket: doc, by, t });
  } catch {}

  return { ok: true, logChannelId, transcriptLink, messageCount, channelName: channel?.name ?? null, staffPoints };
}
