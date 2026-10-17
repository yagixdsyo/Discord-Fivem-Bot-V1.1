/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerComponentHandler } from '../../../ui/interactionRouter.js';
import { card } from '../../../ui/templates/base.js';
import { createTranslator } from '../../../locales/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import {
  addTeamMember,
  getTeam,
  getTeamSettings,
  refreshTeamPanel,
  removeTeamMember,
  setTeamApplicationOpen,
  setTeamBoss,
  teamSync,
} from './teams.js';
import { buildApplyModal, buildApplicationCard, createApplication, getApplication, setApplicationMessage, setApplicationStatus } from './apply.js';
import { buildTeamInfoCard } from './panel.js';

/** Patron veya yonetici mi? (saf fonksiyon - test edilebilir) */
export function canManageTeam(team, member, memberPermissions) {
  if (!team) return false;
  if (memberPermissions?.has?.('ManageGuild')) return true;
  return Boolean(team.boss_id && member?.id === team.boss_id);
}

async function replyCard(interaction, payload) {
  try {
    await interaction.reply(payload);
  } catch {
    await interaction.followUp?.(payload).catch(() => {});
  }
}

function errorCard(t, titleKey, bodyKey, vars = {}) {
  return card({ emojiKey: 'HATA', title: t(titleKey, vars), lines: [t(bodyKey, vars)], accent: 'error', ephemeral: true });
}

function successCard(t, titleKey, bodyKey, vars = {}) {
  return card({ emojiKey: 'BASARI', title: t(titleKey, vars), lines: [t(bodyKey, vars)], accent: 'success', ephemeral: true });
}

async function fetchRole(guild, roleId) {
  if (!roleId) return null;
  return guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
}

/**
 * Panel aksiyonunu isler.
 * @param {import('discord.js').Interaction} interaction
 * @param {string} action
 * @param {string} teamId
 */
export async function handleTeamPanelAction(interaction, action, teamId) {
  const guild = interaction.guild;
  if (!guild) return;

  const settings = await getTeamSettings(guild.id).catch(() => ({ anchorRoleId: null, language: 'tr' }));
  const t = createTranslator(settings.language ?? 'tr');

  const team = await getTeam(guild.id, teamId);
  if (!team || team.closed) {
    await replyCard(interaction, errorCard(t, 'team.panel_not_found_title', 'team.panel_not_found'));
    return;
  }

  if (!canManageTeam(team, interaction.member, interaction.memberPermissions)) {
    await replyCard(interaction, errorCard(t, 'team.panel_no_perm_title', 'team.panel_no_perm'));
    return;
  }

  const targetId = interaction.values?.[0] ?? null;

  switch (action) {
    case 'ekle': {
      if (!targetId) return;
      if ((team.member_ids ?? []).includes(targetId)) {
        await replyCard(interaction, errorCard(t, 'team.member_exists_title', 'team.member_exists', { kullanici: `<@${targetId}>` }));
        return;
      }
      if (team.member_limit > 0 && (team.member_ids ?? []).length >= team.member_limit) {
        await replyCard(interaction, errorCard(t, 'team.limit_full_title', 'team.limit_full', { limit: team.member_limit }));
        return;
      }
      const member = await guild.members.fetch(targetId).catch(() => null);
      if (!member) {
        await replyCard(interaction, errorCard(t, 'team.member_not_found_title', 'team.member_not_found'));
        return;
      }
      const role = await fetchRole(guild, team.role_id);
      let roleOk = true;
      if (role) {
        roleOk = await member.roles
          .add(role, 'Ekip paneli: üye eklendi')
          .then(() => true)
          .catch(() => false);
      }
      await addTeamMember(guild.id, team.team_id, targetId);
      await replyCard(
        interaction,
        successCard(t, 'team.member_added_title', roleOk ? 'team.member_added' : 'team.panel_role_missing', {
          kullanici: `<@${targetId}>`,
        }),
      );
      await refreshTeamPanel({ guild, team: await getTeam(guild.id, team.team_id), t }).catch(() => {});
      return;
    }

    case 'cikar': {
      if (!targetId) return;
      if (targetId === team.boss_id) {
        await replyCard(interaction, errorCard(t, 'team.boss_cannot_remove_title', 'team.boss_cannot_remove'));
        return;
      }
      const member = await guild.members.fetch(targetId).catch(() => null);
      if (member && team.role_id) {
        await member.roles.remove(team.role_id, 'Ekip paneli: üye çıkarıldı').catch(() => {});
      }
      await removeTeamMember(guild.id, team.team_id, targetId);
      await replyCard(interaction, successCard(t, 'team.member_removed_title', 'team.member_removed', { kullanici: `<@${targetId}>` }));
      await refreshTeamPanel({ guild, team: await getTeam(guild.id, team.team_id), t }).catch(() => {});
      return;
    }

    case 'patron': {
      if (!targetId) return;
      const member = await guild.members.fetch(targetId).catch(() => null);
      if (!member) {
        await replyCard(interaction, errorCard(t, 'team.member_not_found_title', 'team.member_not_found'));
        return;
      }
      if (!(team.member_ids ?? []).includes(targetId)) {
        await addTeamMember(guild.id, team.team_id, targetId);
      }
      if (team.role_id) await member.roles.add(team.role_id, 'Ekip patronu').catch(() => {});
      await setTeamBoss(guild.id, team.team_id, targetId);
      await replyCard(interaction, successCard(t, 'team.boss_changed_title', 'team.boss_changed', { kullanici: `<@${targetId}>` }));
      await refreshTeamPanel({ guild, team: await getTeam(guild.id, team.team_id), t }).catch(() => {});
      return;
    }

    case 'basvuru': {
      const next = !team.application_open;
      await setTeamApplicationOpen(guild.id, team.team_id, next);
      await replyCard(
        interaction,
        successCard(
          t,
          'team.application_toggled_title',
          next ? 'team.application_opened' : 'team.application_closed_msg',
        ),
      );
      await refreshTeamPanel({ guild, team: await getTeam(guild.id, team.team_id), t }).catch(() => {});
      return;
    }

    case 'senkron': {
      const result = await teamSync({ guild, team, cfg: { removeExtra: false } });
      await replyCard(
        interaction,
        successCard(t, 'team.sync_done_title', 'team.sync_done', { eklenen: result.added, cikarilan: result.removed }),
      );
      return;
    }

    case 'bilgi': {
      await replyCard(interaction, buildTeamInfoCard(t, team));
      return;
    }

    case 'yenile': {
      const result = await refreshTeamPanel({ guild, team, t });
      if (!result.ok) {
        await replyCard(interaction, errorCard(t, 'team.panel_refreshed_title', 'team.panel_failed'));
        return;
      }
      await replyCard(
        interaction,
        successCard(t, 'team.panel_refreshed_title', result.posted ? 'team.panel_reposted' : 'team.panel_refreshed'),
      );
      return;
    }

    default:
      return;
  }
}

/** Kalici bilesen yonlendiricisine ekip panel handler'ini kaydeder. */
export function registerTeamHandlers() {
  registerComponentHandler('ekip', async (interaction, rest) => {
    const [scope, action, teamId] = rest;
    if (scope !== 'p' || !action || !teamId) return;
    await handleTeamPanelAction(interaction, action, teamId);
  });

  registerComponentHandler('ekipbasvuru', async (interaction, rest) => {
    const [action, arg] = rest ?? [];
    const guild = interaction.guild;
    if (!guild) return;
    const t = createTranslator();

    // Satir butonu: dogrudan basvuru formunu ac.
    if (action === 'basvur') {
      const team = await getTeam(guild.id, arg);
      if (!team || team.closed) {
        await interaction.reply(errorCard(t, 'team.panel_not_found_title', 'team.panel_not_found')).catch(() => {});
        return;
      }
      if (team.application_open === false) {
        await interaction.reply(errorCard(t, 'team.apply_closed_title', 'team.apply_closed')).catch(() => {});
        return;
      }
      await interaction.showModal(buildApplyModal(t, team)).catch(() => {});
      return;
    }

    // Ek kategori menusu: secilen ekip icin form ac.
    if (action === 'sec') {
      const team = await getTeam(guild.id, interaction.values?.[0] ?? '');
      if (!team || team.closed || team.application_open === false) {
        await interaction.reply(errorCard(t, 'team.apply_closed_title', 'team.apply_closed')).catch(() => {});
        return;
      }
      await interaction.showModal(buildApplyModal(t, team)).catch(() => {});
      return;
    }

    // Form gonderimi: basvuruyu kaydet + ekip kanalina ilet.
    if (action === 'form') {
      const teamId = arg;
      const team = await getTeam(guild.id, teamId);
      if (!team || team.closed || team.application_open === false) {
        await interaction.reply(errorCard(t, 'team.apply_closed_title', 'team.apply_closed')).catch(() => {});
        return;
      }
      if ((team.member_ids ?? []).includes(interaction.user.id)) {
        await interaction.reply(errorCard(t, 'team.apply_dup_title', 'team.apply_dup')).catch(() => {});
        return;
      }

      const fields = {
        isim: interaction.fields.getTextInputValue('isim').trim(),
        yas: interaction.fields.getTextInputValue('yas').trim(),
        deneyim: interaction.fields.getTextInputValue('deneyim').trim() || null,
        neden: interaction.fields.getTextInputValue('neden').trim(),
      };
      const app = await createApplication({ guildId: guild.id, team, user: interaction.user, fields });

      const channelId = team.panel_channel_id ?? team.text_channel_id;
      const channel = channelId
        ? guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null))
        : null;
      if (channel?.send) {
        const sent = await channel.send(buildApplicationCard(t, { app, team })).catch(() => null);
        if (sent?.id) await setApplicationMessage(guild.id, app.app_id, channel.id, sent.id);
      }

      await emitLog(guild, 'log_basvuru', {
        actor: interaction.user.id,
        actorTag: interaction.user.username,
        lines: [t('team.apply_log_created', { kullanici: `<@${interaction.user.id}>`, ad: `**${team.name}**` })],
        accent: 'info',
      }).catch(() => {});

      await interaction
        .reply(
          successCard(t, 'team.apply_sent_title', 'team.apply_sent', { ad: team.name }),
        )
        .catch(() => {});
      return;
    }

    // Onay / red: patron ya da yonetici karar verir.
    if (action === 'onay' || action === 'red') {
      const app = await getApplication(guild.id, arg);
      if (!app) {
        await interaction.reply(errorCard(t, 'team.apply_not_found_title', 'team.apply_not_found')).catch(() => {});
        return;
      }
      if (app.status !== 'beklemede') {
        await interaction.reply(errorCard(t, 'team.apply_decided_title', 'team.apply_decided')).catch(() => {});
        return;
      }
      const team = await getTeam(guild.id, app.team_id);
      if (!canManageTeam(team, interaction.member, interaction.memberPermissions)) {
        await interaction.reply(errorCard(t, 'team.panel_no_perm_title', 'team.panel_no_perm')).catch(() => {});
        return;
      }

      const member = await guild.members.fetch(app.user_id).catch(() => null);
      if (action === 'onay') {
        if (member && team?.role_id) {
          await member.roles.add(team.role_id, 'Ekip başvurusu onaylandı').catch(() => {});
        }
        if (member) await addTeamMember(guild.id, app.team_id, app.user_id).catch(() => {});
        await setApplicationStatus(guild.id, app.app_id, 'onaylandi', interaction.user.id);
        await member
          ?.send(
            card({
              emojiKey: 'EKIP',
              title: t('team.apply_dm_approved_title'),
              lines: [t('team.apply_dm_approved', { ad: `**${app.team_name}**` })],
              accent: 'success',
            }),
          )
          .catch(() => {});
      } else {
        await setApplicationStatus(guild.id, app.app_id, 'reddedildi', interaction.user.id);
        await member
          ?.send(
            card({
              emojiKey: 'EKIP',
              title: t('team.apply_dm_rejected_title'),
              lines: [t('team.apply_dm_rejected', { ad: `**${app.team_name}**` })],
              accent: 'warn',
            }),
          )
          .catch(() => {});
      }

      const fresh = await getApplication(guild.id, app.app_id);
      await interaction.update(buildApplicationCard(t, { app: fresh ?? app, team })).catch(() => {});
      await refreshTeamPanel({ guild, team: await getTeam(guild.id, app.team_id), t }).catch(() => {});
      return;
    }
  });
}
