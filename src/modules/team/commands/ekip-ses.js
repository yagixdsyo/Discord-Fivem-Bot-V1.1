/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, list as listTemplate } from '../../../ui/templates/index.js';

export default {
  name: 'ekip-ses',
  aliases: ['ekipses'],
  description: 'Bir ekibin ses kanalı aktivitesini gösterir.',
  category: 'Ekip',
  system: 'ekip',
  cooldown: 5,
  permission: { discord: [] },
  args: [
    { name: 'ekip', type: 'string', required: true, description: 'Ekip adı veya kimliği' },
    { name: 'gun', type: 'integer', required: false, description: 'Dönem (gün, varsayılan 7, en fazla 90)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/teams.js');
    const voice = await import('../lib/voice.js');

    const team = await lib.resolveTeam(ctx.guild.id, ctx.args.ekip);
    if (!team) {
      await ctx.reply(errorTemplate(t('team.not_found_title'), [t('team.not_found', { id: ctx.args.ekip || '-' })]));
      return;
    }

    const days = Math.min(Math.max(Number(ctx.args.gun) || 7, 1), 90);
    const memberIds = team.member_ids ?? [];
    const channelIds = team.voice_channel_id ? [team.voice_channel_id] : null;
    const totals = memberIds.length
      ? await voice.voiceSummary({ guildId: ctx.guild.id, userIds: memberIds, days, channelIds })
      : new Map();

    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const totalSeconds = sorted.reduce((sum, [, seconds]) => sum + seconds, 0);

    const lines = [
      t('team.ses_period', { gun: days }),
      channelIds
        ? t('team.ses_channel', { kanal: `<#${team.voice_channel_id}>` })
        : t('team.ses_all_channels'),
    ];

    if (!sorted.length || totalSeconds <= 0) {
      lines.push(t('team.ses_empty'));
    } else {
      for (const [userId, seconds] of sorted.slice(0, 15)) {
        lines.push(t('team.ses_line', { kullanici: `<@${userId}>`, sure: voice.formatSeconds(seconds) }));
      }
      if (sorted.length > 15) lines.push(t('team.ses_more', { adet: sorted.length - 15 }));
      lines.push(t('team.ses_total', { sure: voice.formatSeconds(totalSeconds) }));
    }

    await ctx.reply(listTemplate({ title: t('team.ses_title', { ad: team.name }), lines }));
  },
};
