/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { runListPager } from '../../moderation/lib/uiFlow.js';
import { listInterviews } from '../lib/interviews.js';
import { interviewListPayload } from '../lib/view.js';

const PAGE_SIZE = 8;

export default {
  name: 'mülakat-liste',
  aliases: ['mulakat-liste'],
  description: 'Mülakat kayıtlarını listeler.',
  category: 'FiveM',
  system: 'mulakat',
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [
    {
      name: 'durum',
      type: 'choice',
      required: false,
      description: 'Durum filtresi',
      choices: [
        { name: 'Beklemede', value: 'beklemede' },
        { name: 'Odada', value: 'odada' },
        { name: 'Geçti', value: 'gecti' },
        { name: 'Kaldı', value: 'kaldi' },
        { name: 'Ertelendi', value: 'ertelendi' },
        { name: 'İptal', value: 'iptal' },
      ],
    },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const items = await listInterviews(ctx.guild.id, { status: ctx.args.durum ?? null, limit: 200 });
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const ownerId = ctx.user.id;

    await runListPager(ctx, {
      namespace: 'mulakatliste',
      totalPages,
      buildPage: (page) => interviewListPayload(t, { items, page, ownerId, pageSize: PAGE_SIZE }),
    });
  },
};
