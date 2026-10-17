/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { listByUser } from '../lib/registration.js';
import { runListPager } from '../../moderation/lib/uiFlow.js';
import { kayitHistoryPayload } from '../lib/view.js';

const PAGE_SIZE = 8;

export default {
  name: 'kayıt-geçmiş',
  aliases: ['kayit-gecmis'],
  description: 'Bir kullanıcının kayıt geçmişini gösterir.',
  category: 'FiveM',
  system: 'kayit',
  cooldown: 5,
  permission: { discord: ['ManageNicknames'] },
  args: [{ name: 'kullanici', type: 'user', required: true, description: 'Kullanıcı' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const arg = ctx.args.kullanici;
    const user = arg?.user ?? arg;
    const items = await listByUser(ctx.guild.id, user.id, { limit: 200 });
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const ownerId = ctx.user.id;

    await runListPager(ctx, {
      namespace: 'kayitgecmis',
      totalPages,
      buildPage: (page) => kayitHistoryPayload(t, { userId: user.id, items, page, ownerId, pageSize: PAGE_SIZE }),
    });
  },
};
