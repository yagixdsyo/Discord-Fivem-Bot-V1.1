/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { actorCounters } from '../lib/registration.js';
import { runListPager } from '../../moderation/lib/uiFlow.js';
import { kayitLogPayload } from '../lib/view.js';

const PAGE_SIZE = 10;

export default {
  name: 'kayıt-log',
  aliases: ['kayit-log'],
  description: 'Kimin kaç kayıt aldığını listeler.',
  category: 'FiveM',
  system: 'kayit',
  cooldown: 5,
  permission: { discord: ['ManageNicknames'] },
  args: [{ name: 'gun', type: 'integer', required: false, description: 'Son N gün (boşsa tümü)' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const days = ctx.args.gun ?? null;
    const items = await actorCounters(ctx.guild.id, { days });
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const ownerId = ctx.user.id;

    await runListPager(ctx, {
      namespace: 'kayitlog',
      totalPages,
      buildPage: (page) => kayitLogPayload(t, { items, page, ownerId, pageSize: PAGE_SIZE }),
    });
  },
};
