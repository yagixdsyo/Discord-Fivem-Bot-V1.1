/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { deleteFlow } from '../lib/flow.js';

export default {
  name: 'backup-sil',
  aliases: ['backupsil'],
  description: 'Kalıcılar hariç tüm backupları siler (onay gerektirir).',
  category: 'Backup',
  cooldown: 10,
  permission: { discord: ['Administrator'] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }
    await deleteFlow(ctx);
  },
};
