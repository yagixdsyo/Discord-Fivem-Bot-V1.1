/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { button, row } from '../../../ui/v2.js';

export default {
  name: 'yetkili-panel',
  aliases: ['yetkilipanel'],
  description: 'Yetkililer için tek panelde hızlı araçlar (panel yenileme, log sıfırlama, ban affı, kanal yenileme).',
  category: 'FiveM',
  system: null,
  cooldown: 15,
  permission: { discord: ['ManageGuild'] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    await ctx.reply(
      card({
        emojiKey: 'AYAR',
        title: t('fivem.tools.title'),
        lines: [t('fivem.tools.intro'), t('fivem.tools.note')],
        accent: 'primary',
        buttons: [
          row([
            button({ id: 'yetpanel:yenile', label: t('fivem.tools.btn_refresh'), emojiKey: 'YENILE', style: 'primary' }),
            button({ id: 'yetpanel:log', label: t('fivem.tools.btn_logs'), emojiKey: 'BELGE', style: 'secondary' }),
          ]),
          row([
            button({ id: 'yetpanel:banaf', label: t('fivem.tools.btn_ban_appeal'), emojiKey: 'UNBAN', style: 'secondary' }),
            button({ id: 'yetpanel:kanal', label: t('fivem.tools.btn_channel'), emojiKey: 'KANAL', style: 'secondary' }),
          ]),
        ],
      }),
    );
  },
};
