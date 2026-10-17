/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from '../../../ui/templates/base.js';
import { button, row } from '../../../ui/v2.js';

export default {
  name: 'oyun-merkezi',
  aliases: ['oyun-panel', 'games'],
  description: 'FiveM temali oyun menu paneli.',
  category: 'Eglence',
  system: null,
  cooldown: 5,
  permission: { discord: [] },
  args: [],
  async run(ctx) {
    const t = ctx.t;
    const panel = card({
      emojiKey: 'OYUN',
      title: t('fun.panel_title'),
      subtitle: t('fun.panel_subtitle'),
      lines: [t('fun.panel_line')],
      sections: [
        t('fun.panel_games'),
        { separator: true },
        t('fun.panel_points'),
      ],
      accent: 'primary',
      buttons: [
        row([
          button({ id: 'fun:zar', label: t('fun.btn_dice'), emojiKey: 'ZAR', style: 'primary' }),
          button({ id: 'fun:yazi', label: t('fun.btn_coin'), emojiKey: 'YAZI_TURA', style: 'secondary' }),
          button({ id: 'fun:slot', label: t('fun.btn_slot'), emojiKey: 'SLOT', style: 'secondary' }),
        ]),
        row([
          button({ id: 'fun:trivia-baslat', label: t('fun.trivia_start'), emojiKey: 'TRIVIA', style: 'primary' }),
          button({ id: 'fun:skor', label: t('fun.panel_score_btn'), emojiKey: 'YILDIZ', style: 'secondary' }),
        ]),
      ],
      footer: `-# ${t('fun.panel_footer')}`,
    });
    await ctx.reply(panel);
  },
};
