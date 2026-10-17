/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { listPunishments } from '../lib/store.js';
import { runListPager } from '../lib/uiFlow.js';
import { historyPayload } from '../lib/view.js';

const PAGE_SIZE = 8;
const MAX_ITEMS = 400;

export default {
  name: 'ceza-geçmiş',
  aliases: ['cezagecmis', 'cezagecmisi'],
  description: 'Bir kullanıcının ceza geçmişini gösterir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  permission: { discord: ['ModerateMembers'], node: 'moderation.uyari' },
  args: [{ name: 'kullanici', type: 'user', required: true, description: 'Kullanıcı' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const target = ctx.args.kullanici;
    const targetUser = target?.user ?? target;

    await emitLog(ctx.guild, 'log_sorgu', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: targetUser.id,
      targetTag: targetUser.username,
      lines: [t('moderation.query.sorgu_line', { tur: t('moderation.query.sorgu_history') })],
      accent: 'info',
    });

    const items = await listPunishments(ctx.guild.id, { userId: targetUser.id, active: null, limit: MAX_ITEMS });
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const ownerId = ctx.user.id;

    await runListPager(ctx, {
      namespace: 'cezagecmis',
      totalPages,
      buildPage: (page) => historyPayload(t, { userId: targetUser.id, items, page, ownerId, pageSize: PAGE_SIZE }),
    });
  },
};
