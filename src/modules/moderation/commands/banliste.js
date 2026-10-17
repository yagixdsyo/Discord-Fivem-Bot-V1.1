/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { listPunishments } from '../lib/store.js';
import { runListPager } from '../lib/uiFlow.js';
import { banListPayload } from '../lib/view.js';

const PAGE_SIZE = 8;
const MAX_ITEMS = 400;

export default {
  name: 'ban-liste',
  aliases: ['banliste'],
  description: 'Ban kayıtlarını listeler.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  permission: { discord: ['ModerateMembers'], node: 'moderation.sorgu' },
  args: [
    {
      name: 'tur',
      type: 'choice',
      required: false,
      description: 'Liste türü',
      choices: [
        { name: 'Aktif', value: 'aktif' },
        { name: 'Süreli', value: 'sureli' },
        { name: 'Kalıcı', value: 'kalici' },
        { name: 'Geçmiş', value: 'gecmis' },
      ],
    },
    { name: 'kullanici', type: 'user', required: false, description: 'Yalnızca bu kullanıcının kayıtları' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const tur = ctx.args.tur ?? 'aktif';
    const userId = ctx.args.kullanici?.id ?? null;
    const activeFilter = tur === 'gecmis' ? null : true;

    let items = await listPunishments(ctx.guild.id, {
      userId,
      type: 'ban',
      active: activeFilter,
      limit: MAX_ITEMS,
    });
    if (tur === 'sureli') items = items.filter((doc) => !doc.permanent);
    if (tur === 'kalici') items = items.filter((doc) => doc.permanent);

    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const ownerId = ctx.user.id;

    await runListPager(ctx, {
      namespace: 'banliste',
      totalPages,
      buildPage: (page) =>
        banListPayload(t, {
          items,
          page,
          ownerId,
          pageSize: PAGE_SIZE,
          filterLabel: t(`moderation.ban_list.filters.${tur}`),
        }),
    });
  },
};
