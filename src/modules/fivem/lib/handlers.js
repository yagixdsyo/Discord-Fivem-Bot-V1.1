/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { registerComponentHandler } from '../../../ui/interactionRouter.js';
import { createTranslator } from '../../../locales/index.js';
import { card } from '../../../ui/templates/base.js';
import {
  confirm as confirmTemplate,
  error as errorTemplate,
  success,
  warn as warnTemplate,
} from '../../../ui/templates/index.js';
import { button, row } from '../../../ui/v2.js';
import { postRegisteredPanels } from '../../setup/lib/panels.js';
import { createDbStore } from '../../setup/lib/store.js';
import { emitLog } from '../../logging/lib/emit.js';
import { resetCounters } from '../../logging/lib/counters.js';
import { markSanctioned } from '../../guard/lib/sanction.js';
import { systemReady } from './gate.js';
import { getChannelId, getRoleId } from './maps.js';
import { getSetting } from './state.js';
import { claimWait, closeWait, registerWait, WAIT_COOLDOWN_MS } from './support.js';
import { moveMember } from './voice.js';
import { decideInterview, getInterview } from './interviews.js';
import { getDmQuestions, runDmQuestions } from './dmInterview.js';
import { getKayitState, refreshKayitPanel, registerMember, unregisterMember } from './kayitFlow.js';
import { decideNameRequest, getNameRequest, getNameTemplate, renderName } from './whitelist.js';
import { decidePermRequest, getPermRequest } from './olusum.js';
import { createComplaint, getComplaint, setComplaintStatus } from './complaints.js';
import { closePoll, getPoll, pollResults, votePoll } from './rules.js';
import {
  complaintCardPayload,
  dmAnswersPayload,
  interviewCardPayload,
  kayitResultPayload,
  pollPayload,
  supportCallPayload,
} from './view.js';

let ready = false;

function hasPerm(interaction, perm) {
  return Boolean(interaction.memberPermissions?.has(perm));
}

async function deny(interaction, t) {
  await interaction
    .reply(errorTemplate(t('errors.no_permission.title'), [t('errors.no_permission.body')], { ephemeral: true }))
    .catch(() => {});
}

async function fetchMember(guild, userId) {
  return guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null));
}

/** Sahiplenilmis/kapanmis destek cagri karti (buton id'leri view.js ile ayni). */
function supportStatePayload(t, { userId, claimedBy = null, closed = false }) {
  const lines = [
    t('fivem.destek.call_line', { kullanici: `<@${userId}>` }),
    claimedBy ? t('fivem.destek.claimed_line', { yetkili: `<@${claimedBy}>` }) : null,
    closed ? t('fivem.destek.closed_line') : t('fivem.destek.call_hint'),
  ].filter(Boolean);

  const buttons = closed
    ? []
    : [
        row([
          button({ id: `destek:sahiplen:${userId}`, label: t('fivem.destek.claim'), emojiKey: 'KULLANICI', style: 'success', disabled: Boolean(claimedBy) }),
          button({ id: `destek:cek:${userId}`, label: t('fivem.destek.pull'), emojiKey: 'SES', style: 'primary' }),
          button({ id: `destek:kapat:${userId}`, label: t('fivem.destek.close'), emojiKey: 'RED', style: 'danger' }),
        ]),
      ];

  return card({
    emojiKey: 'DESTEK',
    title: t('fivem.destek.call_title'),
    lines,
    accent: closed ? 'info' : claimedBy ? 'primary' : 'warn',
    buttons,
  });
}

/** Karara baglanmis isim talebi karti. */
function nameDecidedPayload(t, { doc, approved, by }) {
  return card({
    emojiKey: approved ? 'ONAY' : 'RED',
    title: t(approved ? 'fivem.name.approved_title' : 'fivem.name.rejected_title'),
    lines: [
      t('fivem.name.decided_line', {
        kullanici: `<@${doc.user_id}>`,
        isim: `**${doc.name}**`,
        tur: doc.kind === 'ic' ? t('fivem.name.ic') : t('fivem.name.ooc'),
      }),
      t('fivem.name.decided_by', { yetkili: `<@${by}>` }),
    ],
    accent: approved ? 'success' : 'warn',
    footer: `\`${doc.request_id}\``,
  });
}

/** Karara baglanmis mulakat karti. */
function interviewDecidedPayload(t, { doc, action, by }) {
  const titles = {
    gecti: 'fivem.mulakat.passed_title',
    kaldi: 'fivem.mulakat.failed_title',
    ertele: 'fivem.mulakat.postponed_title',
  };
  const accents = { gecti: 'success', kaldi: 'error', ertele: 'warn' };
  return card({
    emojiKey: action === 'gecti' ? 'ONAY' : action === 'kaldi' ? 'RED' : 'SAAT',
    title: t(titles[action]),
    lines: [
      t('fivem.mulakat.decided_line', {
        kullanici: `<@${doc.user_id}>`,
        durum: t(`fivem.mulakat.status_label.${doc.status}`),
      }),
      t('fivem.mulakat.decided_by', { yetkili: `<@${by}>` }),
    ],
    accent: accents[action],
    footer: `\`${doc.interview_id}\``,
  });
}

/** Durumu guncellenmis sikayet karti. */
function complaintStatusPayload(t, { doc, by }) {
  return card({
    emojiKey: 'SIKAYET',
    title: t('fivem.sikayet.card_title'),
    lines: [
      t('fivem.sikayet.user') + ': ' + `<@${doc.user_id}>`,
      t('fivem.sikayet.target') + ': ' + doc.target,
      t('fivem.sikayet.status') + ': ' + t(`fivem.sikayet.status_label.${doc.status}`),
      t('fivem.sikayet.decided_by', { yetkili: `<@${by}>` }),
    ],
    accent: doc.status === 'sonuclandi' ? 'success' : doc.status === 'reddedildi' ? 'error' : 'warn',
    footer: `\`${doc.complaint_id}\``,
  });
}

export function registerFivemHandlers() {
  if (ready) return;
  ready = true;

  // -------------------------------------------------------------------------
  // Kayit paneli (15.2): kayit et / kayitsiza at
  // -------------------------------------------------------------------------
  registerComponentHandler('kayit', async (interaction, rest) => {
    const t = createTranslator();
    const [action] = rest;
    const guild = interaction.guild;
    if (!guild) return;

    if (!(await systemReady(guild.id, 'kayit'))) {
      await interaction.reply(errorTemplate(t('fivem.kayit.system_off_title'), [t('fivem.kayit.system_off')], { ephemeral: true })).catch(() => {});
      return;
    }
    if (!hasPerm(interaction, 'ManageNicknames')) {
      await deny(interaction, t);
      return;
    }

    if (action === 'et') {
      const state = await getKayitState(guild.id);
      if (!state.open) {
        await interaction.reply(warnTemplate(t('fivem.kayit.registration_closed_title'), [t('fivem.kayit.registration_closed')], { ephemeral: true })).catch(() => {});
        return;
      }
      const userId = interaction.values?.[0];
      if (!userId) return;

      const modal = new ModalBuilder()
        .setCustomId(`kayitmodal:et:${userId}`)
        .setTitle(t('fivem.kayit.modal_title'))
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('icisim')
              .setLabel(t('fivem.kayit.modal_ic'))
              .setStyle(TextInputStyle.Short)
              .setMaxLength(32)
              .setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('oocisim')
              .setLabel(t('fivem.kayit.modal_ooc'))
              .setStyle(TextInputStyle.Short)
              .setMaxLength(32)
              .setRequired(false),
          ),
        );
      await interaction.showModal(modal).catch(() => {});
      return;
    }

    if (action === 'sifirla') {
      const userId = interaction.values?.[0];
      if (!userId) return;
      const payload = confirmTemplate({
        title: t('fivem.kayit.unregister_confirm_title'),
        description: [t('fivem.kayit.unregister_confirm_body', { kullanici: `<@${userId}>` })],
        confirmId: `kayit:sifirlaonay:${userId}`,
        cancelId: `kayit:sifirlaiptal:${userId}`,
        confirmLabel: t('common.confirm'),
        danger: true,
      });
      await interaction.reply({ ...payload, flags: (payload.flags ?? 0) | 64 }).catch(() => {});
      // Onay kartini sadece tiklayan gorur (ephemeral bayragi eklendi).
      return;
    }

    if (action === 'sifirlaonay') {
      const userId = rest[1];
      const member = userId ? await fetchMember(guild, userId) : null;
      if (!member) {
        await interaction.update(errorTemplate(t('fivem.kayit.member_missing_title'), [t('fivem.kayit.member_missing')])).catch(() => {});
        return;
      }
      const result = await unregisterMember(guild, { member, actor: interaction.user });
      if (!result.ok) {
        await interaction.update(errorTemplate(t('fivem.kayit.error_title'), [t('fivem.kayit.error.generic')])).catch(() => {});
        return;
      }

      await emitLog(guild, 'log_kayit', {
        actor: interaction.user.id,
        actorTag: interaction.user.username,
        target: member.id,
        targetTag: member.user.username,
        lines: [t('fivem.kayit.unregister_log', { kullanici: `<@${member.id}>` })],
        accent: 'warn',
        title: t('fivem.kayit.log_title'),
      });

      await interaction
        .update(success(t('fivem.kayit.unregister_done_title'), [t('fivem.kayit.unregister_done', { kullanici: `<@${member.id}>` })]))
        .catch(() => {});
      return;
    }

    if (action === 'sifirlaiptal') {
      await interaction.update(success(t('fivem.kayit.cancel_title'), [t('fivem.kayit.cancel_line')])).catch(() => {});
    }
  });

  // -------------------------------------------------------------------------
  // Kayit modali (panel -> "Kayıt Et" secimi)
  // -------------------------------------------------------------------------
  registerComponentHandler('kayitmodal', async (interaction, rest) => {
    const t = createTranslator();
    const [action, userId] = rest;
    const guild = interaction.guild;
    if (!guild || action !== 'et') return;

    if (!(await systemReady(guild.id, 'kayit'))) {
      await interaction.reply(errorTemplate(t('fivem.kayit.system_off_title'), [t('fivem.kayit.system_off')], { ephemeral: true })).catch(() => {});
      return;
    }
    if (!hasPerm(interaction, 'ManageNicknames')) {
      await deny(interaction, t);
      return;
    }

    const member = userId ? await fetchMember(guild, userId) : null;
    if (!member) {
      await interaction.reply(errorTemplate(t('fivem.kayit.member_missing_title'), [t('fivem.kayit.member_missing')], { ephemeral: true })).catch(() => {});
      return;
    }

    const icName = String(interaction.fields.getTextInputValue('icisim') ?? '').trim();
    const oocRaw = interaction.fields.getTextInputValue('oocisim');
    const oocName = oocRaw ? String(oocRaw).trim() : null;
    if (!icName) {
      await interaction.reply(errorTemplate(t('fivem.kayit.name_required_title'), [t('fivem.kayit.name_required')], { ephemeral: true })).catch(() => {});
      return;
    }

    const minAccountDays = Number((await getSetting(guild.id, 'fivem.kayit.minAgeDays')) ?? 0) || 0;
    const result = await registerMember(guild, {
      member,
      actor: interaction.user,
      actorTag: interaction.user.username,
      icName,
      oocName,
      minAccountDays,
    });

    if (!result.ok) {
      const key = `fivem.kayit.error.${result.error}`;
      const body = t(key) === key ? t('fivem.kayit.error.generic') : t(key);
      await interaction.reply(errorTemplate(t('fivem.kayit.error_title'), [body], { ephemeral: true })).catch(() => {});
      return;
    }

    // kayitli uyede yeni isim verildiyse isim guncelleme akisi.
    if (result.nameUpdated) {
      await emitLog(guild, 'log_isim_degisiklik', {
        actor: interaction.user.id,
        actorTag: interaction.user.username,
        target: member.id,
        targetTag: member.user.username,
        lines: [
          t('fivem.kayit.name_updated', {
            kullanici: `<@${member.id}>`,
            eski: `**${result.previous ?? '-'}**`,
            yeni: `**${result.icName}**`,
          }),
        ],
        accent: 'info',
      });
      await interaction
        .reply(
          success(
            t('fivem.kayit.name_updated_title'),
            [
              t('fivem.kayit.name_updated', {
                kullanici: `<@${member.id}>`,
                eski: `**${result.previous ?? '-'}**`,
                yeni: `**${result.icName}**`,
              }),
              t('fivem.kayit.name_updated_hint'),
            ],
            { ephemeral: true },
          ),
        )
        .catch(() => {});
      return;
    }

    await emitLog(guild, 'log_kayit', {
      actor: interaction.user.id,
      actorTag: interaction.user.username,
      target: member.id,
      targetTag: member.user.username,
      lines: [t('fivem.kayit.log_line', { isim: `**${icName}**`, ooc: oocName ?? '-' })],
      accent: 'success',
      title: t('fivem.kayit.log_title'),
    });
    await emitLog(guild, 'log_isim_degisiklik', {
      actor: interaction.user.id,
      actorTag: interaction.user.username,
      target: member.id,
      targetTag: member.user.username,
      lines: [t('fivem.kayit.nick_log', { isim: `**${icName}**` })],
      accent: 'info',
    });

    const resultPayload = kayitResultPayload(t, { userId: member.id, icName, oocName, actorId: interaction.user.id });
    await member.send(resultPayload).catch(() => {});

    // Kayitsiz sayaci degistiyse paneli tazele (kayitli/kayitsiz rol gecisi).
    const panel = await getSetting(guild.id, 'fivem.kayit.panel');
    if (panel?.channelId) await refreshKayitPanel(guild, t, {}).catch(() => {});

    await interaction.reply({ ...resultPayload, flags: resultPayload.flags | 64 }).catch(() => {});
  });

  // -------------------------------------------------------------------------
  // IC / OOC isim onayi (15.3)
  // -------------------------------------------------------------------------
  registerComponentHandler('icisim', async (interaction, rest) => {
    const t = createTranslator();
    const [action, requestId, ownerId] = rest;
    const guild = interaction.guild;
    if (!guild || !requestId) return;

    if (!(await systemReady(guild.id, 'whitelist'))) {
      await interaction.reply(errorTemplate(t('fivem.wh.system_off_title'), [t('fivem.wh.system_off')], { ephemeral: true })).catch(() => {});
      return;
    }
    if (interaction.user.id !== ownerId && !hasPerm(interaction, 'ManageNicknames')) {
      await deny(interaction, t);
      return;
    }

    const doc = await getNameRequest(guild.id, requestId);
    if (!doc) {
      await interaction.reply(errorTemplate(t('fivem.name.not_found_title'), [t('fivem.name.not_found')], { ephemeral: true })).catch(() => {});
      return;
    }
    if (doc.status !== 'beklemede') {
      await interaction.reply(warnTemplate(t('fivem.name.already_decided_title'), [t('fivem.name.already_decided')], { ephemeral: true })).catch(() => {});
      return;
    }

    const approved = action === 'onay';
    const decision = await decideNameRequest(guild.id, requestId, {
      status: approved ? 'onaylandi' : 'reddedildi',
      by: interaction.user.id,
    });
    if (!decision.ok) {
      await interaction.reply(warnTemplate(t('fivem.name.already_decided_title'), [t('fivem.name.already_decided')], { ephemeral: true })).catch(() => {});
      return;
    }

    if (approved && doc.kind === 'ic') {
      const member = await fetchMember(guild, doc.user_id);
      if (member) {
        const nick = renderName(await getNameTemplate(guild.id), doc.name);
        await member.setNickname(nick, `IC isim onayi: ${interaction.user.id}`).catch(() => {});
      }
    }

    const user = await interaction.client.users.fetch(doc.user_id).catch(() => null);
    if (user) {
      await user
        .send(
          approved
            ? success(t('fivem.name.dm_approved_title'), [t('fivem.name.dm_approved', { sunucu: guild.name, isim: `**${doc.name}**` })])
            : errorTemplate(t('fivem.name.dm_rejected_title'), [t('fivem.name.dm_rejected', { sunucu: guild.name, isim: `**${doc.name}**` })]),
        )
        .catch(() => {});
    }

    await emitLog(guild, 'log_whitelist', {
      actor: interaction.user.id,
      actorTag: interaction.user.username,
      target: doc.user_id,
      targetTag: doc.user_tag,
      lines: [
        t('fivem.name.log_line', {
          kullanici: `<@${doc.user_id}>`,
          tur: doc.kind === 'ic' ? t('fivem.name.ic') : t('fivem.name.ooc'),
          isim: `**${doc.name}**`,
          karar: approved ? t('fivem.name.approved') : t('fivem.name.rejected'),
        }),
      ],
      accent: approved ? 'success' : 'warn',
    });

    await interaction.update(nameDecidedPayload(t, { doc, approved, by: interaction.user.id })).catch(() => {});
  });

  // -------------------------------------------------------------------------
  // Olusum perm talebi (15.4)
  // -------------------------------------------------------------------------
  registerComponentHandler('olusumper', async (interaction, rest) => {
    const t = createTranslator();
    const [action, permId] = rest;
    const guild = interaction.guild;
    if (!guild || !permId) return;

    if (!hasPerm(interaction, 'ManageRoles')) {
      await deny(interaction, t);
      return;
    }

    const doc = await getPermRequest(guild.id, permId);
    if (!doc) {
      await interaction.reply(errorTemplate(t('fivem.olusum.perm_not_found_title'), [t('fivem.olusum.perm_not_found')], { ephemeral: true })).catch(() => {});
      return;
    }
    if (doc.status !== 'beklemede') {
      await interaction.reply(warnTemplate(t('fivem.olusum.perm_already_title'), [t('fivem.olusum.perm_already')], { ephemeral: true })).catch(() => {});
      return;
    }

    const approved = action === 'onay';
    const decision = await decidePermRequest(guild.id, permId, {
      status: approved ? 'onaylandi' : 'reddedildi',
      by: interaction.user.id,
    });
    if (!decision.ok) {
      await interaction.reply(warnTemplate(t('fivem.olusum.perm_already_title'), [t('fivem.olusum.perm_already')], { ephemeral: true })).catch(() => {});
      return;
    }

    let roleGranted = false;
    if (approved && doc.role_name) {
      const role = guild.roles.cache.find((candidate) => candidate.name.toLowerCase() === String(doc.role_name).toLowerCase());
      const member = await fetchMember(guild, doc.user_id);
      const me = guild.members.me;
      if (role && member && me && me.roles.highest.position > role.position && !role.managed) {
        try {
          await markSanctioned({ guildId: guild.id, targetId: member.id, roleIds: [role.id] }).catch(() => {});
          await member.roles.add(role, `Olusum perm onayi: ${interaction.user.id}`);
          roleGranted = true;
        } catch {
          roleGranted = false;
        }
      }
    }

    const user = await interaction.client.users.fetch(doc.user_id).catch(() => null);
    if (user) {
      await user
        .send(
          approved
            ? success(t('fivem.olusum.perm_dm_approved_title'), [
                t('fivem.olusum.perm_dm_approved', { rol: `**${doc.role_name ?? '-'}**` }),
                roleGranted ? t('fivem.olusum.perm_dm_role_granted') : t('fivem.olusum.perm_dm_role_pending'),
              ])
            : errorTemplate(t('fivem.olusum.perm_dm_rejected_title'), [t('fivem.olusum.perm_dm_rejected', { rol: `**${doc.role_name ?? '-'}**` })]),
        )
        .catch(() => {});
    }

    await emitLog(guild, 'log_yetki_ver_al', {
      actor: interaction.user.id,
      actorTag: interaction.user.username,
      target: doc.user_id,
      targetTag: doc.user_tag,
      lines: [
        t('fivem.olusum.log_perm_decision', {
          olusum: `**${doc.name}**`,
          rol: doc.role_name ? `**${doc.role_name}**` : t('common.none'),
          karar: approved ? t('fivem.name.approved') : t('fivem.name.rejected'),
          durum: roleGranted ? t('fivem.olusum.perm_granted_note') : '',
        }),
      ],
      accent: approved ? 'success' : 'warn',
    });

    await interaction
      .update(
        card({
          emojiKey: approved ? 'ONAY' : 'RED',
          title: t('fivem.olusum.perm_decided_title'),
          lines: [
            t('fivem.olusum.perm_decided_line', {
              olusum: `**${doc.name}**`,
              kullanici: `<@${doc.user_id}>`,
              rol: doc.role_name ? `**${doc.role_name}**` : t('common.none'),
              karar: approved ? t('fivem.name.approved') : t('fivem.name.rejected'),
            }),
            roleGranted ? t('fivem.olusum.perm_granted_note') : null,
            t('fivem.name.decided_by', { yetkili: `<@${interaction.user.id}>` }),
          ].filter(Boolean),
          accent: approved ? 'success' : 'warn',
          footer: `\`${doc.perm_id}\``,
        }),
      )
      .catch(() => {});
  });

  // -------------------------------------------------------------------------
  // Destek: cagir / sahiplen / cek / kapat (15.5)
  // -------------------------------------------------------------------------
  registerComponentHandler('destek', async (interaction, rest) => {
    const t = createTranslator();
    const [action, userId] = rest;
    const guild = interaction.guild;
    if (!guild) return;

    if (!(await systemReady(guild.id, 'destek_bekleme'))) {
      await interaction.reply(errorTemplate(t('fivem.destek.system_off_title'), [t('fivem.destek.system_off')], { ephemeral: true })).catch(() => {});
      return;
    }

    if (action === 'cagir') {
      const { spam } = await registerWait({
        guildId: guild.id,
        userId: interaction.user.id,
        userTag: interaction.user.username,
        channelId: interaction.member?.voice?.channelId ?? null,
      });

      if (spam) {
        const rulesId = await getChannelId(guild.id, 'kurallar').catch(() => null);
        await interaction
          .reply(
            warnTemplate(t('fivem.destek.calm_title'), [
              t('fivem.destek.calm_line', { dakika: `**${Math.ceil(WAIT_COOLDOWN_MS / 60_000)}**` }),
              rulesId ? t('fivem.destek.calm_rules', { kanal: `<#${rulesId}>` }) : t('fivem.destek.calm_wait'),
            ], { ephemeral: true }),
          )
          .catch(() => {});
        return;
      }

      const logChannelId = await getChannelId(guild.id, 'log_destek_bekleme');
      const channel = logChannelId
        ? guild.channels.cache.get(logChannelId) ?? (await guild.channels.fetch(logChannelId).catch(() => null))
        : null;

      let posted = false;
      if (channel && typeof channel.send === 'function') {
        const payload = supportCallPayload(t, { userId: interaction.user.id, kind: 'bekleme' });
        const destekRoleIdPing = await getRoleId(guild.id, 'destek');
        if (destekRoleIdPing) payload.allowedMentions = { parse: [], roles: [destekRoleIdPing] };
        posted = await channel.send(payload).then(() => true).catch(() => false);
      }

      await emitLog(guild, 'log_destek_bekleme', {
        actor: interaction.user.id,
        actorTag: interaction.user.username,
        lines: [
          t('fivem.destek.wait_log', {
            kullanici: `<@${interaction.user.id}>`,
            kanal: interaction.member?.voice?.channelId ? `<#${interaction.member.voice.channelId}>` : t('common.none'),
          }),
        ],
        accent: 'warn',
      });

      await interaction
        .reply(
          success(t('fivem.destek.called_title'), [
            t('fivem.destek.called_line'),
            posted ? t('fivem.destek.called_posted') : t('fivem.destek.called_channel_missing'),
          ], { ephemeral: true }),
        )
        .catch(() => {});
      return;
    }

    // Sahiplen / cek / kapat: yetkili islemi.
    const destekRoleId = await getRoleId(guild.id, 'destek');
    const isStaff = hasPerm(interaction, 'ManageRoles') || (destekRoleId && interaction.member?.roles?.cache?.has(destekRoleId));
    if (!isStaff) {
      await deny(interaction, t);
      return;
    }
    if (!userId) return;

    if (action === 'sahiplen') {
      const ok = await claimWait(guild.id, userId, interaction.user.id);
      if (!ok) {
        await interaction
          .reply(warnTemplate(t('fivem.destek.claim_taken_title'), [t('fivem.destek.claim_taken')], { ephemeral: true }))
          .catch(() => {});
        return;
      }
      await interaction.update(supportStatePayload(t, { userId, claimedBy: interaction.user.id })).catch(() => {});
      return;
    }

    if (action === 'cek') {
      const target = await fetchMember(guild, userId);
      const myChannelId = interaction.member?.voice?.channelId;
      if (!myChannelId) {
        await interaction.reply(errorTemplate(t('fivem.voice.not_in_voice_title'), [t('fivem.voice.not_in_voice')], { ephemeral: true })).catch(() => {});
        return;
      }
      if (!target?.voice?.channelId) {
        await interaction.reply(errorTemplate(t('fivem.voice.target_not_in_voice_title'), [t('fivem.voice.target_not_in_voice', { kullanici: `<@${userId}>` })], { ephemeral: true })).catch(() => {});
        return;
      }
      const result = await moveMember(target, myChannelId, { reason: `Destek cekme: ${interaction.user.id}` });
      await interaction
        .reply(
          result.ok
            ? success(t('fivem.voice.move_title'), [t('fivem.voice.moved_to_my', { kullanici: `<@${userId}>`, kanal: `<#${myChannelId}>` })], { ephemeral: true })
            : errorTemplate(t('fivem.voice.move_fail_title'), [t('fivem.voice.move_fail')], { ephemeral: true }),
        )
        .catch(() => {});
      return;
    }

    if (action === 'kapat') {
      const ok = await closeWait(guild.id, userId);
      if (!ok) {
        await interaction.reply(warnTemplate(t('fivem.destek.close_not_found_title'), [t('fivem.destek.close_not_found')], { ephemeral: true })).catch(() => {});
        return;
      }
      await emitLog(guild, 'log_destek_bekleme', {
        actor: interaction.user.id,
        actorTag: interaction.user.username,
        lines: [t('fivem.destek.closed_log', { kullanici: `<@${userId}>` })],
        accent: 'info',
      });
      await interaction.update(supportStatePayload(t, { userId, closed: true })).catch(() => {});
    }
  });

  // -------------------------------------------------------------------------
  // Mulakat karari (15.6)
  // -------------------------------------------------------------------------
  registerComponentHandler('mulakat', async (interaction, rest) => {
    const t = createTranslator();
    const [action, interviewId] = rest;
    const guild = interaction.guild;
    if (!guild || !interviewId) return;

    if (!(await systemReady(guild.id, 'mulakat'))) {
      await interaction.reply(errorTemplate(t('fivem.mulakat.system_off_title'), [t('fivem.mulakat.system_off')], { ephemeral: true })).catch(() => {});
      return;
    }
    if (!hasPerm(interaction, 'ManageRoles')) {
      await deny(interaction, t);
      return;
    }

    if (!['gecti', 'kaldi', 'ertele'].includes(action)) return;

    const doc = await getInterview(guild.id, interviewId);
    if (!doc) {
      await interaction.reply(errorTemplate(t('fivem.mulakat.not_found_title'), [t('fivem.mulakat.not_found')], { ephemeral: true })).catch(() => {});
      return;
    }

    const status = action === 'gecti' ? 'gecti' : action === 'kaldi' ? 'kaldi' : 'ertelendi';
    const decision = await decideInterview(guild.id, interviewId, { status, by: interaction.user.id });
    if (!decision.ok) {
      await interaction.reply(warnTemplate(t('fivem.mulakat.already_decided_title'), [t('fivem.mulakat.already_decided')], { ephemeral: true })).catch(() => {});
      return;
    }

    let roleGranted = false;
    if (action === 'gecti') {
      const member = await fetchMember(guild, doc.user_id);
      const whitelistId = await getRoleId(guild.id, 'whitelist');
      const role = whitelistId ? guild.roles.cache.get(whitelistId) ?? (await guild.roles.fetch(whitelistId).catch(() => null)) : null;
      const me = guild.members.me;
      if (member && role && me && me.roles.highest.position > role.position) {
        try {
          await markSanctioned({ guildId: guild.id, targetId: member.id, roleIds: [role.id] }).catch(() => {});
          await member.roles.add(role, `Mulakat gecti: ${interaction.user.id}`);
          roleGranted = true;
        } catch {
          roleGranted = false;
        }
      }
    }

    const user = await interaction.client.users.fetch(doc.user_id).catch(() => null);
    if (user) {
      const dmPayload =
        action === 'gecti'
          ? success(t('fivem.mulakat.dm_pass_title'), [
              t('fivem.mulakat.dm_pass', { sunucu: guild.name }),
              roleGranted ? t('fivem.mulakat.dm_pass_role') : t('fivem.mulakat.dm_pass_pending'),
            ])
          : action === 'kaldi'
            ? errorTemplate(t('fivem.mulakat.dm_fail_title'), [t('fivem.mulakat.dm_fail', { sunucu: guild.name })])
            : warnTemplate(t('fivem.mulakat.dm_postpone_title'), [t('fivem.mulakat.dm_postpone')]);
      await user.send(dmPayload).catch(() => {});
    }

    await emitLog(guild, 'log_mulakat', {
      actor: interaction.user.id,
      actorTag: interaction.user.username,
      target: doc.user_id,
      targetTag: doc.user_tag,
      lines: [
        t('fivem.mulakat.log_decision', {
          kullanici: `<@${doc.user_id}>`,
          durum: t(`fivem.mulakat.status_label.${status}`),
        }),
      ],
      accent: action === 'gecti' ? 'success' : action === 'kaldi' ? 'error' : 'warn',
    });

    if (action === 'ertele') {
      await interaction.update(interviewCardPayload(t, { doc: { ...doc, status: 'ertelendi' }, ownerId: interaction.user.id })).catch(() => {});
    } else {
      await interaction.update(interviewDecidedPayload(t, { doc: { ...doc, status }, action, by: interaction.user.id })).catch(() => {});
    }
  });

  // -------------------------------------------------------------------------
  // Mulakat DM on soru-cevap (15.6)
  // -------------------------------------------------------------------------
  registerComponentHandler('mulakatdm', async (interaction, rest) => {
    const t = createTranslator();
    const [action, guildId, interviewId] = rest;
    if (action !== 'basla' || !guildId || !interviewId) return;

    const guild = interaction.client.guilds.cache.get(guildId) ?? null;
    if (!guild || !(await systemReady(guildId, 'mulakat'))) {
      await interaction
        .reply(errorTemplate(t('fivem.mulakat.system_off_title'), [t('fivem.mulakat.system_off')]))
        .catch(() => {});
      return;
    }

    const doc = await getInterview(guildId, interviewId);
    if (!doc || doc.user_id !== interaction.user.id) {
      await interaction
        .reply(errorTemplate(t('fivem.mulakat.dm_not_found_title'), [t('fivem.mulakat.dm_not_found')]))
        .catch(() => {});
      return;
    }
    if (doc.dm_answers?.length) {
      await interaction
        .reply(warnTemplate(t('fivem.mulakat.dm_answered_title'), [t('fivem.mulakat.dm_answered')]))
        .catch(() => {});
      return;
    }
    if (!['beklemede', 'odada'].includes(doc.status)) {
      await interaction
        .reply(warnTemplate(t('fivem.mulakat.dm_closed_title'), [t('fivem.mulakat.dm_closed')]))
        .catch(() => {});
      return;
    }

    const questions = await getDmQuestions(guildId);
    await interaction
      .reply(
        card({
          emojiKey: 'MULAKAT',
          title: t('fivem.mulakat.dm_started_title'),
          lines: [t('fivem.mulakat.dm_started', { adet: questions.length })],
          accent: 'info',
        }),
      )
      .catch(() => {});

    const result = await runDmQuestions({ t, user: interaction.user, guildId, interviewId, questions });

    if (!result.ok) {
      const prefix = result.error === 'iptal' ? 'dm_cancel' : result.error === 'zaman_asimi' ? 'dm_timeout' : 'dm_failed';
      await interaction.user
        .send(warnTemplate(t(`fivem.mulakat.${prefix}_title`), [t(`fivem.mulakat.${prefix}`, { adet: result.answers?.length ?? 0 })]))
        .catch(() => {});
      return;
    }

    await interaction.user
      .send(success(t('fivem.mulakat.dm_done_title'), [t('fivem.mulakat.dm_done', { adet: result.answers.length })]))
      .catch(() => {});

    const logChannelId = await getChannelId(guildId, 'log_mulakat').catch(() => null);
    if (logChannelId) {
      const channel = guild.channels.cache.get(logChannelId) ?? (await guild.channels.fetch(logChannelId).catch(() => null));
      if (channel && typeof channel.send === 'function') {
        await channel.send(dmAnswersPayload(t, { doc, answers: result.answers })).catch(() => {});
      }
    }

    await emitLog(guild, 'log_mulakat', {
      actor: interaction.user.id,
      actorTag: interaction.user.username,
      target: doc.user_id,
      targetTag: doc.user_tag,
      lines: [t('fivem.mulakat.dm_log', { kullanici: `<@${doc.user_id}>`, adet: result.answers.length })],
      accent: 'success',
    });
  });

  // -------------------------------------------------------------------------
  // Sikayet paneli + karar butonlari (15.11)
  // -------------------------------------------------------------------------
  registerComponentHandler('sikayet', async (interaction, rest) => {
    const t = createTranslator();
    const [action, complaintId] = rest;
    const guild = interaction.guild;
    if (!guild) return;

    if (action === 'ac') {
      const modal = new ModalBuilder()
        .setCustomId('sikayetmodal:ac')
        .setTitle(t('fivem.sikayet.modal_title'))
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('hedef')
              .setLabel(t('fivem.sikayet.modal_target'))
              .setStyle(TextInputStyle.Short)
              .setMaxLength(100)
              .setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('aciklama')
              .setLabel(t('fivem.sikayet.modal_reason'))
              .setStyle(TextInputStyle.Paragraph)
              .setMaxLength(1000)
              .setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('kanit')
              .setLabel(t('fivem.sikayet.modal_evidence'))
              .setStyle(TextInputStyle.Short)
              .setMaxLength(300)
              .setRequired(false),
          ),
        );
      await interaction.showModal(modal).catch(() => {});
      return;
    }

    if (!complaintId) return;
    if (!hasPerm(interaction, 'ManageRoles')) {
      await deny(interaction, t);
      return;
    }

    const doc = await getComplaint(guild.id, complaintId);
    if (!doc) {
      await interaction.reply(errorTemplate(t('fivem.sikayet.not_found_title'), [t('fivem.sikayet.not_found')], { ephemeral: true })).catch(() => {});
      return;
    }

    const status = action === 'inceleniyor' ? 'inceleniyor' : action === 'sonuclandi' ? 'sonuclandi' : 'reddedildi';
    const updated = await setComplaintStatus(guild.id, complaintId, status, interaction.user.id);
    if (!updated) {
      await interaction.reply(warnTemplate(t('fivem.sikayet.not_found_title'), [t('fivem.sikayet.not_found')], { ephemeral: true })).catch(() => {});
      return;
    }

    if (status !== 'inceleniyor') {
      const user = await interaction.client.users.fetch(doc.user_id).catch(() => null);
      if (user) {
        await user
          .send(
            status === 'sonuclandi'
              ? success(t('fivem.sikayet.dm_done_title'), [t('fivem.sikayet.dm_done', { kod: `\`${doc.complaint_id}\`` })])
              : errorTemplate(t('fivem.sikayet.dm_rejected_title'), [t('fivem.sikayet.dm_rejected', { kod: `\`${doc.complaint_id}\`` })]),
          )
          .catch(() => {});
      }
    }

    await emitLog(guild, 'log_sikayet', {
      actor: interaction.user.id,
      actorTag: interaction.user.username,
      target: doc.user_id,
      targetTag: doc.user_tag,
      lines: [
        t('fivem.sikayet.log_status', {
          kod: `\`${doc.complaint_id}\``,
          durum: t(`fivem.sikayet.status_label.${status}`),
        }),
      ],
      accent: status === 'sonuclandi' ? 'success' : status === 'reddedildi' ? 'error' : 'info',
    });

    await interaction.update(complaintStatusPayload(t, { doc: { ...doc, status }, by: interaction.user.id })).catch(() => {});
  });

  // -------------------------------------------------------------------------
  // Sikayet modali (15.11)
  // -------------------------------------------------------------------------
  registerComponentHandler('sikayetmodal', async (interaction, rest) => {
    const t = createTranslator();
    const [action] = rest;
    const guild = interaction.guild;
    if (!guild || action !== 'ac') return;

    const target = String(interaction.fields.getTextInputValue('hedef') ?? '').trim();
    const reason = String(interaction.fields.getTextInputValue('aciklama') ?? '').trim();
    const evidenceRaw = interaction.fields.getTextInputValue('kanit');
    const evidence = evidenceRaw ? String(evidenceRaw).trim() : null;

    if (!target || !reason) {
      await interaction.reply(errorTemplate(t('fivem.sikayet.invalid_title'), [t('fivem.sikayet.invalid')], { ephemeral: true })).catch(() => {});
      return;
    }

    const doc = await createComplaint({
      guildId: guild.id,
      userId: interaction.user.id,
      userTag: interaction.user.username,
      target,
      reason,
      evidence,
    });

    const logChannelId = await getChannelId(guild.id, 'log_sikayet');
    let posted = false;
    if (logChannelId) {
      const channel = guild.channels.cache.get(logChannelId) ?? (await guild.channels.fetch(logChannelId).catch(() => null));
      if (channel && typeof channel.send === 'function') {
        posted = await channel
          .send(complaintCardPayload(t, { doc, ownerId: interaction.user.id }))
          .then(() => true)
          .catch(() => false);
      }
    }

    await emitLog(guild, 'log_sikayet', {
      actor: interaction.user.id,
      actorTag: interaction.user.username,
      lines: [t('fivem.sikayet.log_created', { kod: `\`${doc.complaint_id}\``, hedef: target })],
      accent: 'warn',
    });

    await interaction
      .reply(
        success(t('fivem.sikayet.created_title'), [
          t('fivem.sikayet.created', { kod: `\`${doc.complaint_id}\`` }),
          posted ? t('fivem.sikayet.created_posted') : t('fivem.sikayet.created_queue'),
        ], { ephemeral: true }),
      )
      .catch(() => {});
  });

  // -------------------------------------------------------------------------
  // Oylama (15.14)
  // -------------------------------------------------------------------------
  registerComponentHandler('oylama', async (interaction, rest) => {
    const t = createTranslator();
    const [action, pollId] = rest;
    const guild = interaction.guild;
    if (!guild || !pollId) return;

    if (action === 'sec') {
      const indexes = (interaction.values ?? []).map((value) => Number.parseInt(value, 10)).filter((value) => Number.isInteger(value));
      const result = await votePoll(guild.id, pollId, interaction.user.id, indexes);
      if (!result.ok) {
        await interaction
          .reply(warnTemplate(t('fivem.poll.closed_title'), [t('fivem.poll.closed_line')], { ephemeral: true }))
          .catch(() => {});
        return;
      }
      await interaction
        .update(
          pollPayload(t, {
            doc: result.doc,
            results: pollResults(result.doc),
            closed: result.doc.status !== 'acik',
            ownerId: result.doc.owner_id ?? null,
          }),
        )
        .catch(() => {});
      return;
    }

    if (action === 'kapat') {
      const doc = await getPoll(guild.id, pollId);
      if (!doc) {
        await interaction.reply(errorTemplate(t('fivem.poll.not_found_title'), [t('fivem.poll.not_found')], { ephemeral: true })).catch(() => {});
        return;
      }
      const isOwner = doc.owner_id === interaction.user.id;
      if (!isOwner && !hasPerm(interaction, 'ManageMessages')) {
        await deny(interaction, t);
        return;
      }
      const closed = await closePoll(guild.id, pollId, { by: interaction.user.id });
      if (!closed.ok) {
        await interaction.reply(warnTemplate(t('fivem.poll.closed_title'), [t('fivem.poll.closed_line')], { ephemeral: true })).catch(() => {});
        return;
      }
      await interaction
        .update(pollPayload(t, { doc: closed.doc, results: pollResults(closed.doc), closed: true, ownerId: null }))
        .catch(() => {});
    }
  });

  // -------------------------------------------------------------------------
  // Kurallar sayfa secimi (15.14) - kalici (restart sonrasi da calisir)
  // -------------------------------------------------------------------------
  registerComponentHandler('kurallar', async (interaction, rest) => {
    const t = createTranslator();
    const [action] = rest;
    if (action !== 'sayfa') return;
    const guild = interaction.guild;
    if (!guild) return;

    const { getRules } = await import('./rules.js');
    const { rulesPayload } = await import('./view.js');
    const { rulesSelectRow } = await import('../commands/kurallar.js');

    const pages = await getRules(guild.id).catch(() => []);
    if (!pages || pages.length === 0) {
      await interaction
        .reply(errorTemplate(t('fivem.rules.empty_title'), [t('fivem.rules.empty')], { ephemeral: true }))
        .catch(() => {});
      return;
    }

    const index = Math.max(0, Math.min(pages.length - 1, Number.parseInt(interaction.values?.[0] ?? '0', 10) || 0));
    const selectRow = pages.length > 1 ? rulesSelectRow(t, pages) : null;
    await interaction.update(rulesPayload(t, { pages, index, selectRow })).catch(() => {});
  });

  // -------------------------------------------------------------------------
  // Yetkili kolay kullanim paneli (15.14)
  // -------------------------------------------------------------------------
  registerComponentHandler('yetpanel', async (interaction, rest) => {
    const t = createTranslator();
    const [action] = rest;
    const guild = interaction.guild;
    if (!guild) return;

    if (!hasPerm(interaction, 'ManageGuild')) {
      await deny(interaction, t);
      return;
    }

    if (action === 'yenile') {
      let result = null;
      try {
        result = await postRegisteredPanels(guild, { store: createDbStore() });
      } catch {
        result = null;
      }
      await interaction
        .reply(
          result
            ? success(t('fivem.refresh.title'), [
                t('fivem.refresh.posted', { adet: `**${result.posted}**` }),
                t('fivem.refresh.skipped', { adet: `**${result.skipped}**` }),
                result.errors.length ? t('fivem.refresh.errors', { adet: `**${result.errors.length}**` }) : t('fivem.refresh.no_errors'),
              ], { ephemeral: true })
            : errorTemplate(t('fivem.refresh.fail_title'), [t('fivem.refresh.fail')], { ephemeral: true }),
        )
        .catch(() => {});
      return;
    }

    if (action === 'log') {
      const result = await resetCounters(guild.id).catch(() => null);
      if (!result) {
        await interaction.reply(errorTemplate(t('fivem.tools.log_fail_title'), [t('fivem.tools.log_fail')], { ephemeral: true })).catch(() => {});
        return;
      }
      await interaction.reply(success(t('fivem.tools.log_done_title'), [t('fivem.tools.log_done')], { ephemeral: true })).catch(() => {});
      return;
    }

    if (action === 'banaf') {
      await interaction
        .reply(
          card({
            emojiKey: 'UNBAN',
            title: t('fivem.tools.ban_appeal_title'),
            lines: [t('fivem.tools.ban_appeal_line'), t('fivem.tools.ban_appeal_usage')],
            accent: 'info',
            ephemeral: true,
          }),
        )
        .catch(() => {});
      return;
    }

    if (action === 'kanal') {
      await interaction
        .reply(
          card({
            emojiKey: 'KANAL',
            title: t('fivem.tools.channel_title'),
            lines: [t('fivem.tools.channel_line'), t('fivem.tools.channel_usage')],
            accent: 'info',
            ephemeral: true,
          }),
        )
        .catch(() => {});
    }
  });
}

// -------------------------------------------------------------------------
// Button self-role panel (15.9)
// -------------------------------------------------------------------------
ready = ready || false;
registerComponentHandler('rolbuton', async (interaction, rest) => {
  const t = createTranslator();
  const [action, roleId] = rest;
  const guild = interaction.guild;
  if (!guild || action !== 'toggle' || !roleId) return;

  if (!(await systemReady(guild.id, 'whitelist'))) {
    await interaction.reply(errorTemplate(t('fivem.kayit.system_off_title'), [t('fivem.kayit.system_off')], { ephemeral: true })).catch(() => {});
    return;
  }

  const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
  if (!role || role.managed) {
    await interaction.reply(errorTemplate(t('fivem.roles.invalid_title'), [t('fivem.roles.invalid')], { ephemeral: true })).catch(() => {});
    return;
  }
  const member = interaction.member ?? (await fetchMember(guild, interaction.user.id));
  if (!member) return;
  const me = guild.members.me;
  if (!me || me.roles.highest.comparePositionTo(role) <= 0) {
    await deny(interaction, t);
    return;
  }

  try {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(role, `Button self-role toggle: ${interaction.user.id}`);
      await markSanctioned({ guildId: guild.id, targetId: member.id, roleIds: [role.id] }).catch(() => {});
      await interaction.reply(success(t('fivem.roles.removed_title'), [t('fivem.roles.removed', { rol: role.name })], { ephemeral: true })).catch(() => {});
    } else {
      await member.roles.add(role, `Button self-role toggle: ${interaction.user.id}`);
      await markSanctioned({ guildId: guild.id, targetId: member.id, roleIds: [role.id] }).catch(() => {});
      await interaction.reply(success(t('fivem.roles.added_title'), [t('fivem.roles.added', { rol: role.name })], { ephemeral: true })).catch(() => {});
    }
  } catch (err) {
    await interaction.reply(errorTemplate(t('fivem.roles.failed_title'), [t('fivem.roles.failed')], { ephemeral: true })).catch(() => {});
  }
});
