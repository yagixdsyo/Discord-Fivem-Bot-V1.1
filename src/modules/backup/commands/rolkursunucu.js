/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { installFlow } from '../lib/flow.js';

export default {
  name: 'rol-kur-sunucu',
  aliases: ['rolkursunucu'],
  description: 'Backup’taki eksik tüm rolleri kurar/günceller.',
  category: 'Backup',
  cooldown: 15,
  permission: { discord: ['Administrator'] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }
    await installFlow(ctx, { kinds: ['manual', 'auto'], temizle: false, idPrefix: 'rolkursunucu', rolesOnly: true });
  },
};
