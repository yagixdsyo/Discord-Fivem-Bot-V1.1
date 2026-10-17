/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ActionRowBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { card } from '../../../ui/templates/base.js';
import { button, row } from '../../../ui/v2.js';
import { findOneDoc, insertDoc, updateDoc } from '../../fivem/lib/store.js';

const COL = 'team_applications';

/** Basvuru kabul eden ekipleri listeler (panel + ek kategori menusu). */
export function buildApplyPanel(t, { teams = [] } = {}) {
  const open = (teams ?? []).filter((team) => team && !team.closed && team.application_open !== false);
  const shown = open.slice(0, 8);
  const rest = open.slice(8, 30);

  const sections = [];
  shown.forEach((team, index) => {
    if (index > 0) sections.push({ separator: true });
    sections.push({
      text: `**${team.name}**\n-# ${t('team.apply_team_line', {
        tur: t(`team.kind_${team.kind}`),
        sayi: (team.member_ids ?? []).length,
        limit: team.member_limit > 0 ? team.member_limit : t('team.apply_unlimited'),
      })}`,
      accessory: button({
        id: `ekipbasvuru:basvur:${team.team_id}`,
        label: t('team.apply_button'),
        emojiKey: 'BASVURU',
        style: 'primary',
      }),
    });
  });

  const buttons = [];
  if (rest.length) {
    buttons.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ekipbasvuru:sec')
          .setPlaceholder(t('team.apply_more_placeholder'))
          .addOptions(
            rest.map((team) => ({
              label: String(team.name).slice(0, 100),
              value: team.team_id,
            })),
          ),
      ),
    );
  }

  return card({
    emojiKey: 'BASVURU',
    title: t('team.apply_panel_title'),
    subtitle: t('team.apply_panel_subtitle', { sayi: open.length }),
    lines: [open.length ? t('team.apply_panel_hint') : t('team.apply_panel_empty')],
    accent: 'primary',
    sections,
    buttons,
    footer: t('team.apply_panel_footer'),
  });
}

/** Basvuru formu modali (isim/yas/deneyim/neden). */
export function buildApplyModal(t, team) {
  const name = String(team?.name ?? '').slice(0, 40);
  return new ModalBuilder()
    .setCustomId(`ekipbasvuru:form:${team.team_id}`)
    .setTitle(name ? t('team.apply_modal_title_named', { ad: name }).slice(0, 44) : t('team.apply_modal_title'))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('isim')
          .setLabel(t('team.apply_field_name'))
          .setStyle(TextInputStyle.Short)
          .setMaxLength(40)
          .setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('yas')
          .setLabel(t('team.apply_field_age'))
          .setStyle(TextInputStyle.Short)
          .setMaxLength(3)
          .setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('deneyim')
          .setLabel(t('team.apply_field_exp'))
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(300)
          .setRequired(false),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('neden')
          .setLabel(t('team.apply_field_reason'))
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setRequired(true),
      ),
    );
}

export async function createApplication({ guildId, team, user, fields }) {
  const doc = {
    app_id: `ea-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    guild_id: guildId,
    team_id: team.team_id,
    team_name: team.name,
    user_id: user.id,
    user_tag: user.username,
    fields,
    status: 'beklemede',
    message_channel_id: null,
    message_id: null,
  };
  await insertDoc(COL, doc);
  return doc;
}

export async function getApplication(guildId, appId) {
  return findOneDoc(COL, { guild_id: guildId, app_id: appId });
}

export async function setApplicationStatus(guildId, appId, status, actorId = null) {
  return updateDoc(COL, { guild_id: guildId, app_id: appId }, {
    status,
    decided_by: actorId,
    decided_at: new Date().toISOString(),
  });
}

export async function setApplicationMessage(guildId, appId, channelId, messageId) {
  return updateDoc(COL, { guild_id: guildId, app_id: appId }, {
    message_channel_id: channelId,
    message_id: messageId,
  });
}

/** Basvuru karti: patron etiketi + alanlar + onay/red butonlari. */
export function buildApplicationCard(t, { app, team = null }) {
  const lines = [
    team?.boss_id ? `<@${team.boss_id}>` : null,
    t('team.apply_card_line', { kullanici: `<@${app.user_id}>`, ad: `**${app.team_name}**` }),
    t('team.apply_card_field', { alan: t('team.apply_field_name'), deger: app.fields?.isim ?? '-' }),
    t('team.apply_card_field', { alan: t('team.apply_field_age'), deger: app.fields?.yas ?? '-' }),
    app.fields?.deneyim
      ? t('team.apply_card_field', { alan: t('team.apply_field_exp'), deger: app.fields.deneyim })
      : null,
    t('team.apply_card_field', { alan: t('team.apply_field_reason'), deger: app.fields?.neden ?? '-' }),
    `**${t('team.apply_status_label')}:** ${t(`team.apply_status_${app.status}`)}`,
  ].filter(Boolean);

  const buttons =
    app.status === 'beklemede'
      ? [
          row([
            button({ id: `ekipbasvuru:onay:${app.app_id}`, label: t('team.apply_approve'), emojiKey: 'ONAY', style: 'success' }),
            button({ id: `ekipbasvuru:red:${app.app_id}`, label: t('team.apply_reject'), emojiKey: 'RED', style: 'danger' }),
          ]),
        ]
      : [];

  return card({
    emojiKey: 'BASVURU',
    title: t('team.apply_card_title'),
    subtitle: `\`${app.app_id}\``,
    lines,
    accent: app.status === 'beklemede' ? 'warn' : app.status === 'onaylandi' ? 'success' : 'error',
    buttons,
    footer: t('team.apply_card_footer'),
  });
}
