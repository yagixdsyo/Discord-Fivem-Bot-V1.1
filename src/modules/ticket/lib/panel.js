/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { card } from '../../../ui/templates/base.js';
import { emoji, emojiObj } from '../../../ui/emoji.js';
import { button } from '../../../ui/v2.js';

/** Panelde satir olarak gosterilen ana kategoriler. */
const MAIN_CATEGORIES = ['destek', 'bug', 'banitiraz', 'sikayet', 'donate', 'basvuru', 'diger'];
/** Secim menusunde listelenen ek kategoriler. */
const EXTRA_CATEGORIES = ['hile', 'yetkili_sikayet', 'teknik', 'rol_hesap', 'faction', 'meslek'];

const CATEGORY_EMOJI = {
  destek: 'DESTEK',
  bug: 'HATA',
  banitiraz: 'BAN',
  sikayet: 'SIKAYET',
  donate: 'YILDIZ',
  basvuru: 'BASVURU',
  diger: 'BELGE',
  hile: 'YASAK',
  yetkili_sikayet: 'SIKAYET',
  teknik: 'AYAR',
  rol_hesap: 'ROL',
  faction: 'EKIP',
  meslek: 'DESTEK',
};

const CATEGORY_STYLE = {
  destek: 'primary',
  bug: 'danger',
  banitiraz: 'secondary',
  sikayet: 'danger',
  donate: 'success',
  basvuru: 'primary',
  diger: 'secondary',
};

/** Kategori secim paneli payload'ini uretir (satir + sag buton duzeni). */
export function buildTicketPanel(t) {
  const sectionEntries = [];
  MAIN_CATEGORIES.forEach((category, index) => {
    if (index > 0) sectionEntries.push({ separator: true });
    sectionEntries.push({
      text: `${emoji(CATEGORY_EMOJI[category])} **${t(`ticket.category.${category}`)}**\n-# ${t(`ticket.category_desc.${category}`)}`,
      accessory: button({
        id: `ticket:ac:${category}`,
        label: t('ticket.panel_open_button'),
        style: CATEGORY_STYLE[category] ?? 'secondary',
        emojiKey: CATEGORY_EMOJI[category],
      }),
    });
  });

  const extraMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket:ac')
      .setPlaceholder(t('ticket.panel_more_placeholder'))
      .addOptions(
        EXTRA_CATEGORIES.map((category) => ({
          label: t(`ticket.category.${category}`),
          value: category,
          emoji: emojiObj(CATEGORY_EMOJI[category] ?? 'BELGE'),
        })),
      ),
  );

  return card({
    emojiKey: 'TICKET',
    title: t('ticket.panel_title'),
    lines: [t('ticket.panel_hint')],
    accent: 'primary',
    sections: sectionEntries,
    buttons: [extraMenu],
    footer: t('ticket.panel_footer'),
  });
}

/** Panel mesaj kimligini ticket ayarlarina yazar (ticket-kur + panel kayitcisi ortak). */
export async function applyTicketPanelState(guildId, { channelId, messageId }) {
  const { getSetting, setSetting } = await import('../../fivem/lib/state.js');
  const { getTicketConfig } = await import('./config.js');

  const existing = (await getSetting(guildId, 'ticket.panel')) ?? {};
  await setSetting(guildId, 'ticket.panel', { ...existing, channelId, messageId });

  const cfg = await getTicketConfig(guildId);
  await setSetting(guildId, 'ticket.config', { ...cfg, panelChannelId: channelId, panelMessageId: messageId });
}
