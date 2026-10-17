/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerComponentHandler } from '../../ui/interactionRouter.js';
import { createTranslator } from '../../locales/index.js';
import { error as errorTemplate, success } from '../../ui/templates/index.js';

const ready = { done: false };

async function getSettingSafe(guildId, key) {
  const { getSetting } = await import('../fivem/lib/state.js');
  return (await getSetting(guildId, key).catch(() => null)) ?? null;
}

async function buildApplicationModal(type) {
  const lib = await import('./lib/applications.js');
  const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
  const rows = [];
  for (const q of lib.APPLICATION_TYPES[type]?.questions ?? []) {
    rows.push(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(`q${rows.length + 1}`).setLabel(q.slice(0, 45)).setStyle(TextInputStyle.Paragraph).setRequired(true)));
  }
  return new ModalBuilder().setCustomId(`basvuru:modal:${type}`).setTitle(lib.APPLICATION_TYPES[type]?.title ?? 'Basvuru').addComponents(...rows);
}

async function buildRejectModal(appId) {
  const t = createTranslator();
  const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
  return new ModalBuilder().setCustomId(`basvuru:redmodal:${appId}`).setTitle(t('application.reject_modal_title'))
    .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sebep').setLabel(t('application.reject_modal_label')).setStyle(TextInputStyle.Paragraph).setRequired(false)));
}

async function handleApplicationModal(interaction, type) {
  const t = createTranslator();
  const lib = await import('./lib/applications.js');
  const questions = lib.APPLICATION_TYPES[type]?.questions ?? [];
  const fields = questions.slice(0, 5).map((q, idx) => ({ q, a: interaction.fields.getTextInputValue(`q${idx + 1}`) }));
  const doc = await lib.createApplication({ guildId: interaction.guildId, userId: interaction.user.id, type, answers: fields });
  await lib.saveDraft({ guildId: interaction.guildId, userId: interaction.user.id, type, answers: fields }).catch(() => {});
  await lib.markDraftDone(interaction.guildId, doc.application_id).catch(() => {});
  await interaction.reply(success(t('application.saved_title'), [t('application.saved', { id: doc.application_id })], { ephemeral: true })).catch(() => {});

  const logChannelId = (await getSettingSafe(interaction.guildId, 'application.logChannelId')) || interaction.channelId;
  const ch = interaction.guild.channels.cache.get(logChannelId) ?? (await interaction.guild.channels.fetch(logChannelId).catch(() => null));
  if (!ch?.send) return;
  const { card } = await import('../../ui/templates/base.js');
  const { row, button } = await import('../../ui/v2.js');
  const panel = card({
    emojiKey: 'BASVURU',
    title: t('application.log_title', { id: doc.application_id }),
    lines: [type, ...fields.map((x) => `**${x.q}**: ${x.a}`)],
    accent: 'info',
    buttons: [row([
      button({ id: `basvuru:admin:${doc.application_id}:onay`, label: t('common.approve'), emojiKey: 'EKLE', style: 'primary' }),
      button({ id: `basvuru:admin:${doc.application_id}:mulakat`, label: t('application.btn_interview'), style: 'secondary', emojiKey: 'MULAKAT' }),
      button({ id: `basvuru:admin:${doc.application_id}:red`, label: t('common.deny'), style: 'danger', emojiKey: 'RED' }),
    ])],
  });
  await ch.send(panel).catch(() => {});
}

function registerHandlers() {
  if (ready.done) return;
  ready.done = true;

  registerComponentHandler('basvuru', async (interaction, rest) => {
    const t = createTranslator();
    const [action, value, _extra] = rest || [];
    const lib = await import('./lib/applications.js');

    if (action === 'panel') {
      const type = interaction.values?.[0] || value;
      if (!type || !(lib.getApplicationTypes()[type])) {
        await interaction.reply(errorTemplate(t('application.invalid_type_title'), [t('application.invalid_type')], { ephemeral: true })).catch(() => {});
        return;
      }
      const banned = await lib.isBlacklisted(interaction.guildId, interaction.user.id);
      if (banned) {
        await interaction.reply(errorTemplate(t('application.blacklisted_title'), [t('application.blacklisted')], { ephemeral: true })).catch(() => {});
        return;
      }
      if (await lib.hasCooldown(interaction.guildId, interaction.user.id, type)) {
        await interaction.reply(errorTemplate(t('application.cooldown_title'), [t('application.cooldown')], { ephemeral: true })).catch(() => {});
        return;
      }
      const modal = await buildApplicationModal(type);
      await interaction.showModal(modal).catch(() => {});
      return;
    }

    if (action === 'modal') {
      try {
        await handleApplicationModal(interaction, value);
      } catch {
        await interaction.reply(errorTemplate(t('application.save_fail_title'), [t('application.save_fail')], { ephemeral: true })).catch(() => {});
      }
      return;
    }

    if (action === 'redmodal') {
      const appId = value;
      const sebep = interaction.fields.getTextInputValue('sebep');
      const ok = await lib.reviewApplication({ guildId: interaction.guildId, appId, reviewerId: interaction.user.id, status: 'reddedildi', reason: sebep });
      await interaction.reply(ok
        ? success(t('application.rejected_title'), [t('application.rejected')], { ephemeral: true })
        : errorTemplate(t('application.not_found_title'), [t('application.not_found')], { ephemeral: true })).catch(() => {});
      if (ok) {
        const app = await lib.getApplication(interaction.guildId, appId);
        if (app?.user_id) {
          const user = await interaction.client.users.fetch(app.user_id).catch(() => null);
          if (user) {
            const dm = success(t('application.rejected_dm_title'), [
              t('application.rejected_dm'),
              sebep ? t('application.reason_line', { sebep }) : null,
            ].filter(Boolean));
            await user.send(dm).catch(() => {});
          }
        }
      }
      return;
    }

    if (action === 'admin') {
      const sub = _extra;
      const appId = value;
      const app = await lib.getApplication(interaction.guildId, appId);
      if (!app) {
        await interaction.reply(errorTemplate(t('application.not_found_title'), [t('application.not_found')], { ephemeral: true })).catch(() => {});
        return;
      }
      if (sub === 'onay') {
        const roles = await lib.getApplicationRoles(interaction.guildId);
        const roleId = roles[app.type];
        let autoRole = null;
        if (roleId) {
          const member = await interaction.guild.members.fetch(app.user_id).catch(() => null);
          if (member) { await member.roles.add(roleId).catch(() => {}); autoRole = roleId; }
        }
        await lib.reviewApplication({ guildId: interaction.guildId, appId, reviewerId: interaction.user.id, status: 'onaylandi' });
        if (autoRole) await lib.updateApplicationAutoRole(appId, autoRole).catch(() => {});
        await interaction.reply(success(t('application.approved_title'), [t('application.approved')], { ephemeral: true })).catch(() => {});
        const user = await interaction.client.users.fetch(app.user_id).catch(() => null);
        if (user) {
          const dm = success(t('application.approved_dm_title'), [
            t('application.approved_dm', { tur: app.type }),
            autoRole ? t('application.role_given') : null,
          ].filter(Boolean));
          await user.send(dm).catch(() => {});
        }
        return;
      }
      if (sub === 'mulakat') {
        await lib.reviewApplication({ guildId: interaction.guildId, appId, reviewerId: interaction.user.id, status: 'mulakat' });
        await interaction.reply(success(t('application.interview_title'), [t('application.interview')], { ephemeral: true })).catch(() => {});
        const user = await interaction.client.users.fetch(app.user_id).catch(() => null);
        if (user) await user.send(success(t('application.interview_dm_title'), [t('application.interview_dm', { tur: app.type })])).catch(() => {});
        return;
      }
      if (sub === 'red') {
        const modal = await buildRejectModal(appId);
        await interaction.showModal(modal).catch(() => {});
        return;
      }
    }
  });
}

export default {
  id: 'application',
  name: 'Başvuru',
  description: 'Yetkili, whitelist ve ekip başvuru sistemleri.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,
  async setup(client, { logger }) {
    registerHandlers();
    logger.info('Application modulu hazir');
  },
};
