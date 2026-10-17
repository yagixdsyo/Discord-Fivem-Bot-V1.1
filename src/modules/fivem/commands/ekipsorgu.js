/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { runListPager } from '../../moderation/lib/uiFlow.js';
import { getTeam, listTeams } from '../lib/teams.js';
import { ekipInfoPayload, ekipListPayload } from '../lib/view.js';

const PAGE_SIZE = 10;

export default {
  name: 'ekipsorgu',
  aliases: ['ekip-sorgu'],
  description: 'Ekip detayını gösterir; argümansız tüm ekipleri listeler.',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'ekip', type: 'string', required: false, description: 'Ekip adı veya ID' },
    { name: 'patron', type: 'user', required: false, description: 'Patrona göre filtrele' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const key = ctx.args.ekip ? String(ctx.args.ekip).trim() : null;
    const patronArg = ctx.args.patron;
    const patron = patronArg?.user ?? patronArg;

    if (key) {
      const team = (await getTeam(ctx.guild.id, { teamId: key })) ?? (await getTeam(ctx.guild.id, { name: key }));
      if (!team) {
        await ctx.reply(errorTemplate(t('fivem.ekip.not_found_title'), [t('fivem.ekip.not_found', { ekip: key })]));
        return;
      }
      const roleObj = ctx.guild.roles.cache.get(team.role_id) ?? (await ctx.guild.roles.fetch(team.role_id).catch(() => null));
      await ctx.reply(ekipInfoPayload(t, { team, memberCount: roleObj?.members?.size ?? null }));
      return;
    }

    let items = await listTeams(ctx.guild.id, { active: true, limit: 200 });
    if (patron) items = items.filter((team) => team.patron_id === patron.id);

    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const ownerId = ctx.user.id;

    await runListPager(ctx, {
      namespace: 'ekipliste',
      totalPages,
      buildPage: (page) => ekipListPayload(t, { items, page, ownerId, pageSize: PAGE_SIZE }),
    });
  },
};
