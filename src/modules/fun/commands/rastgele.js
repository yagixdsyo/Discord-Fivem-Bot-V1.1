/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';

export default {
  name: 'rastgele',
  aliases: ['random', 'luck'],
  description: 'Virgulle ayrilmis listeden rastgele secim yapar.',
  category: 'Eglence',
  system: null,
  cooldown: 2,
  permission: { discord: [] },
  args: [{ name: 'liste', type: 'rest', required: true, description: 'Virgulle ayrilmis secenekler' }],
  async run(ctx) {
    const t = ctx.t;
    const options = String(ctx.args.liste ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    if (options.length < 2) {
      await ctx.reply(errorTemplate(t('fun.random_need_two_title'), [t('fun.random_need_two')]));
      return;
    }
    const choice = options[Math.floor(Math.random() * options.length)];
    await ctx.reply(
      card({
        emojiKey: 'YILDIZ',
        title: t('fun.random_title'),
        subtitle: t('fun.random_subtitle', { sayi: options.length }),
        lines: [t('fun.random_line', { secim: `**${choice}**` })],
        accent: 'primary',
        footer: `-# ${t('fun.random_footer')}`,
      }),
    );
  },
};
