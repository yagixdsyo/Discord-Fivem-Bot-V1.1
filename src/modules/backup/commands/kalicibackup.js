/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { createBackup } from '../lib/create.js';
import { listBackups } from '../lib/store.js';
import { installFlow } from '../lib/flow.js';
import { backupListPayload, backupSummaryPayload } from '../lib/view.js';

export default {
  name: 'kalıcı-backup',
  aliases: ['kalici-backup'],
  description: 'Kalıcı backup alır/gösterir/kurur (otomatik silinmez).',
  category: 'Backup',
  cooldown: 10,
  permission: { discord: ['Administrator'] },
  args: [
    {
      name: 'islem',
      type: 'choice',
      required: true,
      description: 'İşlem',
      choices: ['al', 'goster', 'kur'].map((value) => ({ name: value, value })),
    },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const islem = String(ctx.args.islem ?? 'goster').toLowerCase();

    if (islem === 'al') {
      const result = await createBackup(ctx.guild, { kind: 'permanent', by: ctx.user.id });
      await ctx.reply(backupSummaryPayload(t, { result }));
      return;
    }

    if (islem === 'goster') {
      const docs = (await listBackups(ctx.guild.id)).filter((doc) => doc.kind === 'permanent');
      await ctx.reply(backupListPayload(t, { docs }));
      return;
    }

    if (islem === 'kur') {
      await installFlow(ctx, { kinds: ['permanent'], temizle: false, idPrefix: 'backupkalici' });
    }
  },
};
