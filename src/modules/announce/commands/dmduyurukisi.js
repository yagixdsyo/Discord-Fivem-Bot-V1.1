/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { runDmFlow } from '../lib/flow.js';

export default {
  name: 'dm-duyuru-kişi',
  aliases: [],
  description: 'Belirtilen kullanıcı(lar)a DM duyurusu gönderir.',
  category: 'DM Duyuru',
  system: 'dm_duyuru',
  cooldown: 15,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Hedef kullanıcı' },
    { name: 'mesaj', type: 'rest', required: true, description: 'Gönderilecek mesaj' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }
    const arg = ctx.args.kullanici;
    const user = arg?.user ?? arg;
    await runDmFlow(ctx, {
      source: 'kisi',
      userIds: [user.id],
      sourceLabel: t('announce.sources.user', { kullanici: user.tag ?? user.username ?? user.id }),
    });
  },
};
