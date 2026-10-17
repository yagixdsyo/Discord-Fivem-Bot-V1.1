/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, list as listTemplate } from '../../../ui/templates/index.js';

export default {
  name: 'ekip-ses-aktiflik',
  aliases: ['ekipsesaktiflik'],
  description: 'Ekip üyelerinin ses aktivitesini eşikle karşılaştırır.',
  category: 'Ekip',
  system: 'ekip',
  cooldown: 10,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'ekip', type: 'string', required: true, description: 'Ekip adı veya kimliği' },
    { name: 'gun', type: 'integer', required: false, description: 'Dönem (gün, varsayılan 7, en fazla 90)' },
    { name: 'esik', type: 'integer', required: false, description: 'Eşik (dakika, varsayılan 60)' },
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
    const thresholdMinutes = Math.min(Math.max(Number(ctx.args.esik) || 60, 5), 24 * 60);
    const thresholdSeconds = thresholdMinutes * 60;

    const memberIds = team.member_ids ?? [];
    const channelIds = team.voice_channel_id ? [team.voice_channel_id] : null;
    const totals = memberIds.length
      ? await voice.voiceSummary({ guildId: ctx.guild.id, userIds: memberIds, days, channelIds })
      : new Map();

    const passed = [];
    const failed = [];
    for (const [userId, seconds] of totals.entries()) {
      if (seconds >= thresholdSeconds) passed.push([userId, seconds]);
      else failed.push([userId, seconds]);
    }
    passed.sort((a, b) => b[1] - a[1]);
    failed.sort((a, b) => b[1] - a[1]);

    const total = totals.size;
    const pct = total > 0 ? Math.round((passed.length / total) * 100) : 0;

    const lines = [
      t('team.sesakt_period', { gun: days, esik: thresholdMinutes }),
      channelIds
        ? t('team.ses_channel', { kanal: `<#${team.voice_channel_id}>` })
        : t('team.ses_all_channels'),
      t('team.sesakt_result', { gecen: passed.length, toplam: total, yuzde: pct }),
    ];

    if (passed.length) {
      lines.push(t('team.sesakt_pass_list'));
      for (const [userId, seconds] of passed.slice(0, 15)) {
        lines.push(t('team.sesakt_line', { kullanici: `<@${userId}>`, sure: voice.formatSeconds(seconds) }));
      }
    }
    if (failed.length) {
      lines.push(t('team.sesakt_fail_list'));
      for (const [userId, seconds] of failed.slice(0, 15)) {
        lines.push(
          seconds > 0
            ? t('team.sesakt_line', { kullanici: `<@${userId}>`, sure: voice.formatSeconds(seconds) })
            : t('team.sesakt_none', { kullanici: `<@${userId}>` }),
        );
      }
      if (failed.length > 15) lines.push(t('team.ses_more', { adet: failed.length - 15 }));
    }
    if (!total) lines.push(t('team.ses_empty'));

    await ctx.reply(listTemplate({ title: t('team.sesakt_title', { ad: team.name }), lines }));
  },
};
