/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from '../../../ui/templates/base.js';
import { error as errorTemplate } from '../../../ui/templates/index.js';
import { button, row } from '../../../ui/v2.js';
import { getTicketConfig } from './config.js';
import { createTicket, findOpenByUser, ticketCount } from './tickets.js';

const CATEGORIES = ['destek', 'bug', 'banitiraz', 'sikayet', 'donate', 'basvuru', 'diger', 'hile', 'yetkili_sikayet', 'teknik', 'rol_hesap', 'faction', 'meslek'];

export function ticketCategories() { return CATEGORIES.slice(); }

export async function openTicket(guild, opener, { category = 'destek', subject = null } = {}) {
  const t = (await import('../../../locales/index.js')).createTranslator();
  const cfg = await getTicketConfig(guild);

  const existing = await import('./tickets.js').then((m) => m.findOpenByUser(guild.id, opener.id));
  if (existing) {
    return { ok: false, error: 'zaten_acik', existing };
  }

  const categoryChannel = cfg.ticketCategoryId
    ? (guild.channels.cache.get(cfg.ticketCategoryId) ?? (await guild.channels.fetch(cfg.ticketCategoryId).catch(() => null)))
    : null;

  const n = (await ticketCount(guild.id)) + 1;
  const channelName = (cfg.nameTemplate ?? 'ticket-{n}').replace('{n}', String(n)).replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase().slice(0, 95);

  const overwrites = [
    { id: guild.id, deny: ['ViewChannel', 'SendMessages'] },
    { id: opener.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'EmbedLinks'] },
  ];
  for (const roleId of cfg.staffRoles ?? []) {
    overwrites.push({ id: roleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'] });
  }
  // ensure bot
  // (bot's own perms default)

  let channel;
  try {
    channel = await guild.channels.create({ name: channelName, type: 0, parent: categoryChannel?.id ?? null, permissionOverwrites: overwrites });
  } catch (err) {
    return { ok: false, error: 'kanal_olusturulamadi' };
  }

  const doc = await createTicket({ guildId: guild.id, channelId: channel.id, userId: opener.id, category, subject, createdBy: opener.id });
  doc.number = n;

  try {
    const { button, row } = await import('../../../ui/v2.js');
    const catLabel = t(`ticket.category.${category}`);
    const panel = card({
      emojiKey: 'TICKET',
      title: `${t('ticket.open_title', { kod: doc.ticket_id })}`,
      lines: [
        t('ticket.open_user', { kullanici: opener.toString() }),
        t('ticket.open_category', { kategori: catLabel }),
        subject ? t('ticket.open_subject', { konu: subject }) : null,
        t('ticket.open_hint'),
      ].filter(Boolean),
      accent: 'info',
      buttons: [
        row([
          button({ id: `ticket:sahiplen:${doc.ticket_id}`, label: t('ticket.claim_button'), emojiKey: 'EKLE', style: 'primary' }),
          button({ id: `ticket:kapat:${doc.ticket_id}`, label: t('ticket.close_button'), emojiKey: 'KILIT', style: 'danger' }),
          button({ id: `ticket:notlar:${doc.ticket_id}`, label: t('ticket.notes_button'), emojiKey: 'NOT', style: 'secondary' }),
        ]),
        row([
          button({ id: `ticket:uekle:${doc.ticket_id}`, label: t('ticket.btn_add_member'), emojiKey: 'EKLE', style: 'secondary' }),
          button({ id: `ticket:ucikar:${doc.ticket_id}`, label: t('ticket.btn_remove_member'), emojiKey: 'CIKAR', style: 'secondary' }),
          button({ id: `ticket:isim:${doc.ticket_id}`, label: t('ticket.btn_rename'), emojiKey: 'DUZENLE', style: 'secondary' }),
          button({ id: `ticket:devret:${doc.ticket_id}`, label: t('ticket.btn_transfer'), emojiKey: 'KULLANICI', style: 'secondary' }),
        ]),
      ],
      footer: t('ticket.open_footer'),
    });
    await channel.send(panel);
  } catch {}

  return { ok: true, doc, channel };
}
