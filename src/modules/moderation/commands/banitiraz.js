/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { card, disabledCard } from '../../../ui/templates/base.js';
import { error as errorTemplate, success as successTemplate, warn as warnTemplate } from '../../../ui/templates/index.js';
import { EPHEMERAL_FLAG } from '../../../ui/limits.js';
import { button, row } from '../../../ui/v2.js';
import { resolveLogChannelId } from '../../logging/lib/cache.js';
import { ensureMessage, waitForInteraction, waitForModalSubmit } from '../../setup/lib/interact.js';
import { createAppeal, decideAppeal, liftActivePunishments, listPunishments } from '../lib/store.js';

const DECISION_TIMEOUT_MS = 60 * 60_000;

function withEphemeral(payload) {
  return { ...payload, flags: (payload.flags ?? 0) | EPHEMERAL_FLAG };
}

export default {
  name: 'ban-itiraz',
  aliases: ['banitiraz'],
  description: 'Ban itiraz formu gönderir (yetkililer onaylar/reddeder).',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 60,
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'İtiraz edilen kullanıcı' },
    { name: 'sebep', type: 'rest', required: false, description: 'Kısa not (formda detay istenir)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const target = ctx.args.kullanici;
    const targetUser = target?.user ?? target;

    const activeBan =
      (await listPunishments(ctx.guild.id, { userId: targetUser.id, type: 'ban', active: true, limit: 1 }))[0] ?? null;
    if (!activeBan) {
      await ctx.reply(errorTemplate(t('moderation.appeal.no_ban_title'), [t('moderation.appeal.no_ban_body')]));
      return;
    }

    const ownerId = ctx.user.id;
    const formCard = card({
      emojiKey: 'DUYURU',
      title: t('moderation.appeal.form_title'),
      lines: [
        t('moderation.appeal.form_body', { kullanici: `<@${targetUser.id}>` }),
        t('moderation.appeal.form_case', { kod: `\`${activeBan.case_id}\`` }),
      ],
      buttons: [
        row([
          button({
            id: `itirazform:${ownerId}`,
            label: t('moderation.appeal.form_button'),
            emojiKey: 'BELGE',
            style: 'primary',
          }),
        ]),
      ],
      accent: 'info',
    });

    const message = await ensureMessage(ctx, await ctx.reply(formCard, { fetchReply: true }));
    if (!message || typeof message.awaitMessageComponent !== 'function') return;

    const click = await waitForInteraction(message, ownerId);
    if (!click || click.customId !== `itirazform:${ownerId}`) {
      await message.edit(disabledCard(formCard)).catch(() => {});
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`itirazmodal:${ownerId}`)
      .setTitle(t('moderation.appeal.modal_title'))
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('gerekce')
            .setLabel(t('moderation.appeal.modal_reason'))
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(900),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('kanit')
            .setLabel(t('moderation.appeal.modal_evidence'))
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(300),
        ),
      );

    await click.showModal(modal).catch(() => {});
    const submit = await waitForModalSubmit(message, { customId: `itirazmodal:${ownerId}`, ownerId });
    if (!submit) {
      await message.edit(disabledCard(formCard)).catch(() => {});
      return;
    }

    await submit.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    await message.edit(disabledCard(formCard)).catch(() => {});

    const gerekce = submit.fields.getTextInputValue('gerekce');
    const kanit = submit.fields.getTextInputValue('kanit') || null;

    const appeal = await createAppeal({
      guildId: ctx.guild.id,
      userId: targetUser.id,
      userName: targetUser.username ?? null,
      banCase: activeBan.case_id,
      reason: gerekce,
      evidence: kanit,
    });

    const channelId = await resolveLogChannelId(ctx.guild.id, 'log_ban_itiraz').catch(() => null);
    const channel = channelId
      ? ctx.guild.channels.cache.get(channelId) ?? (await ctx.guild.channels.fetch(channelId).catch(() => null))
      : null;

    if (!channel?.isTextBased?.()) {
      await submit
        .editReply(
          warnTemplate(t('moderation.appeal.no_channel_title'), [t('moderation.appeal.no_channel_body')]),
        )
        .catch(() => {});
      return;
    }

    const decisionCard = card({
      emojiKey: 'BAN',
      title: t('moderation.appeal.decision_title'),
      lines: [
        t('moderation.appeal.decision_user', { kullanici: `<@${targetUser.id}>` }),
        t('moderation.appeal.decision_case', { kod: `\`${activeBan.case_id}\`` }),
        t('moderation.appeal.decision_reason', { sebep: gerekce }),
        kanit ? t('moderation.appeal.decision_evidence', { kanit }) : null,
        t('moderation.appeal.decision_submitter', { kisi: `<@${ctx.user.id}>` }),
      ].filter(Boolean),
      buttons: [
        row([
          button({
            id: `itiraz:onay:${appeal.appeal_id}`,
            label: t('moderation.appeal.approve'),
            emojiKey: 'ONAY',
            style: 'success',
          }),
          button({
            id: `itiraz:red:${appeal.appeal_id}`,
            label: t('moderation.appeal.reject'),
            emojiKey: 'RED',
            style: 'danger',
          }),
        ]),
      ],
      accent: 'warn',
    });

    const sent = await channel.send(decisionCard).catch(() => null);
    await submit
      .editReply(successTemplate(t('moderation.appeal.received_title'), [t('moderation.appeal.received_body')]))
      .catch(() => {});

    if (!sent) return;

    for (;;) {
      let interaction = null;
      try {
        interaction = await sent.awaitMessageComponent({ time: DECISION_TIMEOUT_MS });
      } catch {
        interaction = null;
      }
      if (!interaction) {
        await sent.edit(disabledCard(decisionCard)).catch(() => {});
        return;
      }

      const parts = interaction.customId.split(':');
      const karar = parts[1];
      const appealId = parts[2];
      if (parts[0] !== 'itiraz' || (karar !== 'onay' && karar !== 'red')) {
        await interaction.deferUpdate().catch(() => {});
        continue;
      }

      const canDecide = interaction.member?.permissions?.has?.('BanMembers') ?? false;
      if (!canDecide) {
        await interaction
          .reply(withEphemeral(warnTemplate(t('moderation.appeal.no_perm_title'), [t('moderation.appeal.no_perm_body')])))
          .catch(() => {});
        continue;
      }

      const status = karar === 'onay' ? 'onaylandi' : 'reddedildi';
      const decided = await decideAppeal(ctx.guild.id, appealId, { status, by: interaction.user.id });
      if (!decided.ok) {
        await interaction.deferUpdate().catch(() => {});
        continue;
      }

      if (status === 'onaylandi') {
        await liftActivePunishments(ctx.guild.id, {
          userId: decided.doc.user_id,
          types: ['ban'],
          actorId: interaction.user.id,
          reason: 'Ban itirazı onaylandı',
        });
        await ctx.guild.bans.remove(decided.doc.user_id, 'Ban itirazı onaylandı').catch(() => {});
      }

      const doneCard =
        status === 'onaylandi'
          ? successTemplate(t('moderation.appeal.done_approved_title'), [
              t('moderation.appeal.done_approved_body', { kisi: `<@${interaction.user.id}>` }),
            ])
          : errorTemplate(t('moderation.appeal.done_rejected_title'), [
              t('moderation.appeal.done_rejected_body', { kisi: `<@${interaction.user.id}>` }),
            ]);

      await interaction.update(doneCard).catch(() => {});

      try {
        const punished = await ctx.client.users.fetch(decided.doc.user_id);
        await punished.send(
          card({
            emojiKey: status === 'onaylandi' ? 'UNBAN' : 'BAN',
            title:
              status === 'onaylandi'
                ? t('moderation.appeal.dm_approved_title', { sunucu: ctx.guild.name })
                : t('moderation.appeal.dm_rejected_title', { sunucu: ctx.guild.name }),
            lines: [t('moderation.appeal.dm_body')],
            accent: status === 'onaylandi' ? 'success' : 'error',
          }),
        );
      } catch {
        /* DM kapali */
      }
      return;
    }
  },
};
