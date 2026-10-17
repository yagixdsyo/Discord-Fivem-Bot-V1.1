/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';

export default {
  name: 'analitik',
  aliases: ['dashboard'],
  description: 'Mesai, ticket, basvuru, ekip ve oyun istatistiklerini V2 özette gosterir.',
  category: 'Analitik',
  system: 'analitik',
  cooldown: 10,
  permission: { discord: [] },
  args: [{ name: 'alan', type: 'string', required: false, description: 'tum|mesai|ticket|basvuru|ekip|oyun' }],
  async run(ctx) {
    const t = ctx.t;
    const alan = ['tum', 'mesai', 'ticket', 'basvuru', 'ekip', 'oyun'].includes(ctx.args.alan) ? ctx.args.alan : 'tum';
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const guild = ctx.guild;
    const rows = [];
    if (['tum', 'mesai'].includes(alan)) {
      const lib = await import('../../shift/lib/shifts.js');
      const actives = await lib.listActiveShifts(guild.id).catch(() => []);
      const leaderboard = await lib.shiftLeaderboard(guild.id, { period: 'gunluk', limit: 3 }).catch(() => []);
      const cfg = await lib.getShiftConfig(guild.id).catch(() => ({}));
      rows.push(t('analytic.mesai_block', { aktif: actives.length, voice: (cfg.autoStartVoiceChannelIds || []).length }));
      rows.push(t('analytic.mesai_top', { top: leaderboard.map((x, idx) => `${idx + 1}. <@${x.userId}>`).join(' | ') || '-' }));
    }
    if (['tum', 'ticket'].includes(alan)) {
      const { listTickets } = await import('../../ticket/lib/tickets.js');
      const tickets = await listTickets(guild.id, { limit: 1000 }).catch(() => []);
      const statusCount = (status) => tickets.filter((x) => x.status === status).length;
      rows.push(t('analytic.ticket_block', { acik: statusCount('acik'), beklemede: statusCount('beklemede'), kapali: statusCount('kapali'), toplam: tickets.length }));
    }
    if (['tum', 'basvuru'].includes(alan)) {
      const { listApplications } = await import('../../application/lib/applications.js');
      const apps = await listApplications(guild.id, { limit: 1000 }).catch(() => []);
      const statusCount = (status) => apps.filter((x) => x.status === status).length;
      rows.push(t('analytic.application_block', { beklemede: statusCount('beklemede'), onay: statusCount('onaylandi'), red: statusCount('reddedildi'), mulakat: statusCount('mulakat') }));
    }
    if (['tum', 'ekip'].includes(alan)) {
      const { listTeams } = await import('../../team/lib/teams.js');
      const teams = await listTeams(guild.id, { closed: false }).catch(() => []);
      const allTeams = await listTeams(guild.id).catch(() => teams);
      rows.push(t('analytic.team_block', { aktif: teams.length, toplam: allTeams.length, boss: teams.filter((x) => x.boss_id).length }));
    }
    if (['tum', 'oyun'].includes(alan)) {
      const { getTop } = await import('../../fun/lib/scoreboard.js');
      const top = await getTop(guild.id, 3).catch(() => []);
      rows.push(t('analytic.fun_block', { top: top.map((x, idx) => `${idx + 1}. <@${x.userId}> (${x.score})`).join(' | ') || '-' }));
    }
    rows.push(t('analytic.member_block', { toplam: guild.memberCount }));

    await ctx.reply(card({
      emojiKey: 'GRAFIK',
      title: t('analytic.title'),
      subtitle: alan,
      lines: rows,
      accent: 'primary',
      footer: `${new Date().toISOString().slice(0, 16)} UTC`,
      buttons: [],
    }));
  },
};
