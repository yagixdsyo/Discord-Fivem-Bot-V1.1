/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { getSafeList } from '../lib/config.js';
import { listRecentIncidents } from '../lib/incidents.js';
import { incidentsPayload, guvenliListPayload } from '../lib/view.js';

export default {
  name: 'guvenli-bilgilendirme',
  aliases: ['guvenlibilgilendirme'],
  description: 'Güvenli kullanıcıların guard kayıtlarını özetler.',
  category: 'Guard',
  system: 'guard',
  cooldown: 5,
  permission: { discord: ['Administrator'] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const entries = await getSafeList(ctx.guild.id);
    const safeIds = new Set(entries.map((doc) => doc.user_id));
    const incidents = (await listRecentIncidents(ctx.guild.id, 200)).filter(
      (doc) => doc.safe && doc.actor_id && safeIds.has(doc.actor_id),
    );

    await ctx.reply(guvenliListPayload(t, { entries }));
    await ctx.followUp(
      incidentsPayload(t, { incidents: incidents.slice(0, 10), title: t('guard.safe.actions_title') }),
    ).catch(() => {});
  },
};
