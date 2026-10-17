/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ChannelType } from 'discord.js';
import { card } from '../../../ui/templates/base.js';
import { getRoleId } from '../lib/maps.js';

const STAFF_KEYS = ['yonetici', 'ust_yetkili', 'moderator', 'yetkili', 'destek', 'ban_yetkilisi', 'mulakatci', 'kayit_yetkilisi'];
const MAX_LINES = 40;

export default {
  name: 'yetkilises',
  aliases: ['yetkili-ses'],
  description: 'Ses kanallarında bulunan yetkilileri kanal kanal listeler.',
  category: 'FiveM',
  system: null,
  cooldown: 10,
  permission: { discord: ['ManageRoles'] },
  args: [],

  async run(ctx) {
    const t = ctx.t;

    const staffIds = new Set();
    for (const key of STAFF_KEYS) {
      const id = await getRoleId(ctx.guild.id, key);
      if (id) staffIds.add(id);
    }
    if (staffIds.size === 0) {
      await ctx.reply(card({ emojiKey: 'HATA', title: t('fivem.voice.no_staff_roles_title'), lines: [t('fivem.voice.no_staff_roles')], accent: 'error' }));
      return;
    }

    const byChannel = new Map();
    for (const state of ctx.guild.voiceStates.cache.values()) {
      if (!state.channelId) continue;
      const member = state.member;
      if (!member || member.user.bot) continue;
      if (![...staffIds].some((id) => member.roles.cache.has(id))) continue;
      const list = byChannel.get(state.channelId) ?? [];
      list.push(member.id);
      byChannel.set(state.channelId, list);
    }

    if (byChannel.size === 0) {
      await ctx.reply(card({ emojiKey: 'BILGI', title: t('fivem.voice.staff_none_title'), lines: [t('fivem.voice.staff_none')], accent: 'info' }));
      return;
    }

    const lines = [];
    let total = 0;
    for (const [channelId, ids] of byChannel) {
      const channel = ctx.guild.channels.cache.get(channelId);
      if (channel?.type !== ChannelType.GuildVoice) continue;
      total += ids.length;
      lines.push(t('fivem.voice.staff_line', { kanal: `<#${channelId}>`, adet: `**${ids.length}**`, liste: ids.map((id) => `<@${id}>`).join(', ') }));
      if (lines.length >= MAX_LINES) break;
    }

    await ctx.reply(
      card({
        emojiKey: 'SES',
        title: t('fivem.voice.staff_title'),
        lines: [t('fivem.voice.staff_total', { adet: `**${total}**`, kanal: `**${byChannel.size}**` }), ...lines],
        accent: 'primary',
      }),
    );
  },
};
