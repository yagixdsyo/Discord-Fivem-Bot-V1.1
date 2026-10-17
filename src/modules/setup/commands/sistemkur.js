/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { runSetupWizard } from '../lib/wizard.js';

export default {
  name: 'sistemkur',
  aliases: ['sistem-kur', 'kurulum'],
  description: 'Rolleri, kanalları ve logları tek komutla kurar (idempotent, onarıcı).',
  category: 'Sistem',
  cooldown: 10,
  permission: { discord: ['Administrator'] },
  args: [
    {
      name: 'sıfırla',
      type: 'boolean',
      required: false,
      description: 'Önce mevcut kurulumu silip baştan kurar (onaylı, veri silinmez)',
    },
  ],
  examples: ['/sistemkur', '/sistemkur sıfırla:true', '.sistemkur sıfırla'],

  async run(ctx) {
    const t = ctx.t;

    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    await runSetupWizard(ctx, { resetFirst: ctx.args['sıfırla'] === true });
  },
};
