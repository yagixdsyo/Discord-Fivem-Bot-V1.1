/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { searchOlusums } from '../lib/olusum.js';
import { runListPager } from '../../moderation/lib/uiFlow.js';
import { olusumListPayload } from '../lib/view.js';

const PAGE_SIZE = 10;

export default {
  name: 'oluşum-sorgu',
  aliases: ['olusum-sorgu'],
  description: 'Aktif oluşumları listeler; ad ile filtreler.',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [{ name: 'ad', type: 'string', required: false, description: 'Ad filtresi' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const filter = ctx.args.ad ? String(ctx.args.ad).trim().toLowerCase() : null;
    let items = await searchOlusums(ctx.guild.id, { active: null, limit: 200 });
    if (filter) items = items.filter((doc) => doc.name.toLowerCase().includes(filter));

    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const ownerId = ctx.user.id;

    await runListPager(ctx, {
      namespace: 'olusumliste',
      totalPages,
      buildPage: (page) => olusumListPayload(t, { items, page, ownerId, pageSize: PAGE_SIZE }),
    });
  },
};
