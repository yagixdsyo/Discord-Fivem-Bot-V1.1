/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { getProtectedRoles } from '../lib/config.js';
import { korumaliListPayload } from '../lib/view.js';

export default {
  name: 'guard-liste',
  aliases: ['guardliste'],
  description: 'Guard korumasındaki rolleri listeler.',
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
    const entries = await getProtectedRoles(ctx.guild.id);
    await ctx.reply(korumaliListPayload(t, { entries }));
  },
};
