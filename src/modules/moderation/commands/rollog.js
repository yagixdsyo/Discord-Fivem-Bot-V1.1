/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { listRoleLogs } from '../lib/store.js';
import { runListPager } from '../lib/uiFlow.js';
import { roleLogsPayload } from '../lib/view.js';

const PAGE_SIZE = 8;
const MAX_ITEMS = 400;

export default {
  name: 'rollog',
  aliases: ['rol-log'],
  description: 'Bir kullanıcının rol değişim kayıtlarını gösterir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  permission: { discord: ['ManageRoles'] },
  args: [{ name: 'kullanici', type: 'user', required: true, description: 'Kullanıcı' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const target = ctx.args.kullanici;
    const targetUser = target?.user ?? target;
    const items = await listRoleLogs(ctx.guild.id, { userId: targetUser.id, limit: MAX_ITEMS });
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const ownerId = ctx.user.id;

    await runListPager(ctx, {
      namespace: 'rollog',
      totalPages,
      buildPage: (page) => roleLogsPayload(t, { userId: targetUser.id, items, page, ownerId, pageSize: PAGE_SIZE }),
    });
  },
};
