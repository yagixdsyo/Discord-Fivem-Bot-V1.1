/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { postRegisteredPanels } from '../../setup/lib/panels.js';
import { createDbStore } from '../../setup/lib/store.js';

export default {
  name: 'bot-panelleri-yenile',
  aliases: ['botpanelleriyenile'],
  description: 'Kurulumda kaydedilen tüm panelleri kontrol eder, eksikleri yeniden yayınlar.',
  category: 'FiveM',
  system: null,
  cooldown: 30,
  permission: { discord: ['ManageGuild'] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    let result;
    try {
      result = await postRegisteredPanels(ctx.guild, { store: createDbStore() });
    } catch (err) {
      await ctx.reply(errorTemplate(t('fivem.refresh.fail_title'), [t('fivem.refresh.fail')]));
      return;
    }

    await ctx.reply(
      success(t('fivem.refresh.title'), [
        t('fivem.refresh.posted', { adet: `**${result.posted}**` }),
        t('fivem.refresh.skipped', { adet: `**${result.skipped}**` }),
        result.errors.length ? t('fivem.refresh.errors', { adet: `**${result.errors.length}**` }) : t('fivem.refresh.no_errors'),
      ]),
    );
  },
};
