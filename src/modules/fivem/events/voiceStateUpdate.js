/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { createTranslator } from '../../../locales/index.js';
import { card } from '../../../ui/templates/base.js';
import { warn as warnTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { systemReady } from '../lib/gate.js';
import { getChannelId, getRoleId } from '../lib/maps.js';
import { supportCallPayload } from '../lib/view.js';
import { registerWait, WAIT_COOLDOWN_MS } from '../lib/support.js';
import { getActiveByUser, setRoom } from '../lib/interviews.js';
import { findDocs, updateDoc } from '../lib/store.js';

const INTERVIEW_STAFF_KEYS = ['mulakatci', 'yonetici', 'ust_yetkili'];

function isChannelEmpty(channel) {
  if (!channel?.members) return false;
  return [...channel.members.values()].every((member) => member.user?.bot);
}

async function notifyDestekWait(guild, member, t) {
  const { spam } = await registerWait({
    guildId: guild.id,
    userId: member.id,
    userTag: member.user.username,
    channelId: member.voice?.channelId ?? null,
  });

  if (spam) {
    const rulesId = await getChannelId(guild.id, 'kurallar').catch(() => null);
    const rulesChannel = rulesId ? guild.channels.cache.get(rulesId) : null;
    await member
      .send(
        warnTemplate(t('fivem.destek.calm_dm_title'), [
          t('fivem.destek.calm_line', { dakika: `**${Math.ceil(WAIT_COOLDOWN_MS / 60_000)}**` }),
          rulesChannel ? t('fivem.destek.calm_rules', { kanal: `<#${rulesChannel.id}>` }) : t('fivem.destek.calm_wait'),
        ]),
      )
      .catch(() => {});
    return;
  }

  const logChannelId = await getChannelId(guild.id, 'log_destek_bekleme').catch(() => null);
  const channel = logChannelId
    ? guild.channels.cache.get(logChannelId) ?? (await guild.channels.fetch(logChannelId).catch(() => null))
    : null;

  if (channel && typeof channel.send === 'function') {
    const payload = supportCallPayload(t, { userId: member.id, kind: 'bekleme' });
    const destekRoleId = await getRoleId(guild.id, 'destek');
    if (destekRoleId) payload.allowedMentions = { parse: [], roles: [destekRoleId] };
    await channel.send(payload).catch(() => {});
  }

  await emitLog(guild, 'log_destek_bekleme', {
    actor: member.id,
    actorTag: member.user.username,
    lines: [
      t('fivem.destek.wait_log', {
        kullanici: `<@${member.id}>`,
        kanal: member.voice?.channelId ? `<#${member.voice.channelId}>` : t('common.none'),
      }),
    ],
    accent: 'warn',
  });
}

async function startInterviewRoom(guild, member, t) {
  const doc = await getActiveByUser(guild.id, member.id).catch(() => null);
  if (!doc || doc.status !== 'beklemede') return;

  const waitChannelId = await getChannelId(guild.id, 'mulakat_bekleme').catch(() => null);
  const waitChannel = waitChannelId
    ? guild.channels.cache.get(waitChannelId) ?? (await guild.channels.fetch(waitChannelId).catch(() => null))
    : null;

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
    },
    {
      id: member.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
    },
  ];

  for (const key of INTERVIEW_STAFF_KEYS) {
    const roleId = await getRoleId(guild.id, key);
    if (roleId && !overwrites.some((entry) => entry.id === roleId)) {
      overwrites.push({
        id: roleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
      });
    }
  }

  const channel = await guild.channels
    .create({
      name: `Mülakat ││ ${member.displayName}`.slice(0, 100),
      type: ChannelType.GuildVoice,
      parent: waitChannel?.parentId ?? null,
      userLimit: 2,
      permissionOverwrites: overwrites,
      reason: `Mulakat odasi: ${doc.interview_id}`,
    })
    .catch(() => null);

  if (!channel) return;

  await setRoom(guild.id, doc.interview_id, channel.id).catch(() => {});
  await member.voice.setChannel(channel, `Mulakat odasi: ${doc.interview_id}`).catch(() => {});

  const logChannelId = await getChannelId(guild.id, 'log_mulakat').catch(() => null);
  if (logChannelId) {
    const logChannel = guild.channels.cache.get(logChannelId) ?? (await guild.channels.fetch(logChannelId).catch(() => null));
    if (logChannel && typeof logChannel.send === 'function') {
      await logChannel
        .send(
          card({
            emojiKey: 'MULAKAT',
            title: t('fivem.mulakat.room_title'),
            lines: [
              t('fivem.mulakat.room_line', {
                kullanici: `<@${member.id}>`,
                kanal: `<#${channel.id}>`,
              }),
            ],
            accent: 'info',
            footer: `\`${doc.interview_id}\``,
          }),
        )
        .catch(() => {});
    }
  }

  await emitLog(guild, 'log_mulakat', {
    actor: member.id,
    actorTag: member.user.username,
    lines: [t('fivem.mulakat.room_log', { kullanici: `<@${member.id}>`, kanal: `<#${channel.id}>` })],
    accent: 'info',
  });
}

async function cleanupInterviewRoom(guild, channelId) {
  const rows = await findDocs('interviews', { guild_id: guild.id, room_id: channelId }, { limit: 1 }).catch(() => []);
  const doc = rows[0];
  if (!doc) return;

  const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
  if (channel && isChannelEmpty(channel)) {
    await channel.delete(`Mulakat odasi bosaldi: ${doc.interview_id}`).catch(() => {});
    await updateDoc('interviews', { guild_id: guild.id, interview_id: doc.interview_id }, { room_id: null }).catch(() => {});
  }
}

export default {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const guild = newState?.guild ?? oldState?.guild;
    if (!guild) return;
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    const joined = newState.channelId && newState.channelId !== oldState.channelId;
    const left = oldState.channelId && oldState.channelId !== newState.channelId;

    if (joined) {
      if (await systemReady(guild.id, 'destek_bekleme')) {
        const waitId = await getChannelId(guild.id, 'destek_bekleme').catch(() => null);
        if (waitId && newState.channelId === waitId) {
          await notifyDestekWait(guild, member, createTranslator()).catch(() => {});
        }
      }

      if (await systemReady(guild.id, 'mulakat')) {
        const mulakatId = await getChannelId(guild.id, 'mulakat_bekleme').catch(() => null);
        if (mulakatId && newState.channelId === mulakatId) {
          await startInterviewRoom(guild, member, createTranslator()).catch(() => {});
        }
      }
    }

    if (left) {
      await cleanupInterviewRoom(guild, oldState.channelId).catch(() => {});
    }
  },
};
