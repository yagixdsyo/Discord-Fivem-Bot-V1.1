/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { runListPager } from '../../moderation/lib/uiFlow.js';
import { listDonates } from '../lib/donate.js';
import { donateListPayload } from '../lib/view.js';

const PAGE_SIZE = 8;

export default {
  name: 'donate-liste',
  aliases: ['donateliste'],
  description: 'Donate kayıtlarını listeler; kullanıcı ile filtreler.',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [{ name: 'kullanici', type: 'user', required: false, description: 'Kullanıcı filtresi' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const arg = ctx.args.kullanici;
    const user = arg?.user ?? arg;
    const items = await listDonates(ctx.guild.id, { userId: user?.id ?? null, limit: 300 });
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const ownerId = ctx.user.id;

    await runListPager(ctx, {
      namespace: 'donatelist',
      totalPages,
      buildPage: (page) => donateListPayload(t, { items, page, ownerId, pageSize: PAGE_SIZE }),
    });
  },
};
