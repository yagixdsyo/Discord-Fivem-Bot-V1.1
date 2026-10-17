/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { listTeams } from '../../fivem/lib/teams.js';
import { runDmFlow } from '../lib/flow.js';

export default {
  name: 'dm-duyuru-ekip',
  aliases: [],
  description: 'Bir ekibin tüm üyelerine DM duyurusu gönderir.',
  category: 'DM Duyuru',
  system: 'dm_duyuru',
  cooldown: 30,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'ekip', type: 'string', required: true, description: 'Ekip adı' },
    { name: 'mesaj', type: 'rest', required: true, description: 'Gönderilecek mesaj' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const name = String(ctx.args.ekip ?? '').trim().toLowerCase();
    const teams = await listTeams(ctx.guild.id, { limit: 100 }).catch(() => []);
    const team = teams.find((item) => item.name.toLowerCase() === name);
    if (!team) {
      await ctx.reply(errorTemplate(t('fivem.ekip.not_found_title'), [t('fivem.ekip.not_found', { ekip: ctx.args.ekip })]));
      return;
    }

    await runDmFlow(ctx, {
      source: 'rol',
      roleId: team.role_id,
      sourceLabel: t('announce.sources.team', { ekip: team.name }),
    });
  },
};
