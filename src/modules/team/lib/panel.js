/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ActionRowBuilder, UserSelectMenuBuilder } from 'discord.js';
import { card } from '../../../ui/templates/base.js';
import { button } from '../../../ui/v2.js';
import { getColor } from '../../../ui/colors.js';

/** Ekip rengini (hex) sayiya cevirir; yoksa ana renk. */
export function resolveTeamAccent(color) {
  const raw = String(color || '').trim();
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (/^[0-9A-Fa-f]{6}$/.test(hex)) return Number.parseInt(hex, 16);
  return getColor('primary');
}

/**
 * Ekip yonetim paneli payload'u.
 * @param {(key: string, vars?: object) => string} t
 * @param {object} team
 */
export function buildTeamPanel(t, team) {
  const accent = resolveTeamAccent(team.color);
  const memberCount = team.member_ids?.length ?? 0;
  const memberText = team.member_limit > 0 ? `${memberCount}/${team.member_limit}` : String(memberCount);

  const addRow = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`ekip:p:ekle:${team.team_id}`)
      .setPlaceholder(t('team.panel_select_add'))
      .setMinValues(1)
      .setMaxValues(1),
  );
  const removeRow = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`ekip:p:cikar:${team.team_id}`)
      .setPlaceholder(t('team.panel_select_remove'))
      .setMinValues(1)
      .setMaxValues(1),
  );
  const bossRow = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`ekip:p:patron:${team.team_id}`)
      .setPlaceholder(t('team.panel_select_boss'))
      .setMinValues(1)
      .setMaxValues(1),
  );

  const buttonsRow = new ActionRowBuilder().addComponents(
    button({
      id: `ekip:p:basvuru:${team.team_id}`,
      label: team.application_open ? t('team.btn_application_close') : t('team.btn_application_open'),
      style: team.application_open ? 'danger' : 'success',
      emojiKey: team.application_open ? 'KILIT' : 'KILIT_ACIK',
    }),
    button({ id: `ekip:p:senkron:${team.team_id}`, label: t('team.btn_sync'), style: 'secondary', emojiKey: 'YENILE' }),
    button({ id: `ekip:p:bilgi:${team.team_id}`, label: t('team.btn_info'), style: 'secondary', emojiKey: 'BILGI' }),
    button({ id: `ekip:p:yenile:${team.team_id}`, label: t('team.btn_refresh'), style: 'primary', emojiKey: 'GRAFIK' }),
  );

  return card({
    emojiKey: 'EKIP',
    title: t('team.panel_title', { ad: team.name }),
    subtitle: t('team.panel_subtitle'),
    lines: [
      `**${t('team.panel_label_members')}:** ${memberText}`,
      `**${t('team.panel_label_boss')}:** ${team.boss_id ? `<@${team.boss_id}>` : '-'}`,
      `**${t('team.panel_label_status')}:** ${team.closed ? t('team.closed') : t('team.open')}`,
      `**${t('team.panel_label_application')}:** ${team.application_open ? t('team.application_open') : t('team.application_closed')}`,
      `**${t('team.panel_label_channels')}:** ${team.text_channel_id ? `<#${team.text_channel_id}>` : '-'} / ${team.voice_channel_id ? `<#${team.voice_channel_id}>` : '-'}`,
    ],
    accentColor: accent,
    buttons: [addRow, removeRow, bossRow, buttonsRow],
    footer: t('team.panel_footer'),
  });
}

/**
 * Zengin ekip detay karti (/ekip sorgu + panel bilgi).
 * @param {(key: string, vars?: object) => string} t
 * @param {object} team
 */
export function buildTeamInfoCard(t, team) {
  const accent = resolveTeamAccent(team.color);
  const lines = [
    t('team.show_name', { ad: team.name, id: team.team_id }),
    t('team.show_kind', { tur: team.kind, sayi: team.member_ids?.length ?? 0 }),
    t('team.show_boss', { boss: team.boss_id ? `<@${team.boss_id}>` : '-' }),
    t('team.show_role', { rol: team.role_id ? `<@&${team.role_id}>` : '-' }),
    t('team.show_channels', {
      metin: team.text_channel_id ? `<#${team.text_channel_id}>` : '-',
      ses: team.voice_channel_id ? `<#${team.voice_channel_id}>` : '-',
    }),
    t('team.show_status', { durum: team.closed ? t('team.closed') : t('team.open') }),
    t('team.show_application', {
      durum: team.application_open ? t('team.application_open') : t('team.application_closed'),
    }),
  ];

  const buttons = [];
  if (team.panel_channel_id && team.guild_id) {
    buttons.push([
      button({
        url: `https://discord.com/channels/${team.guild_id}/${team.panel_channel_id}`,
        label: t('team.btn_go_panel'),
        style: 'link',
      }),
    ]);
  }

  return card({
    emojiKey: 'EKIP',
    title: t('team.details_title'),
    subtitle: team.name,
    lines,
    accentColor: accent,
    buttons,
    footer: t('team.panel_footer'),
  });
}
