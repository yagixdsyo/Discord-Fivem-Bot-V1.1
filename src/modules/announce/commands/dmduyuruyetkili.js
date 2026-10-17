/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { runDmFlow } from '../lib/flow.js';

export default {
  name: 'dm-duyuru-yetkili',
  aliases: [],
  description: 'Tüm yetkililere DM duyurusu gönderir.',
  category: 'DM Duyuru',
  system: 'dm_duyuru',
  cooldown: 30,
  permission: { discord: ['ManageGuild'] },
  args: [{ name: 'mesaj', type: 'rest', required: true, description: 'Gönderilecek mesaj' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }
    await runDmFlow(ctx, { source: 'yetkili', sourceLabel: t('announce.sources.staff') });
  },
};
