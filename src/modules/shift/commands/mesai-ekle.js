/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';

export default {
  name: 'mesai-ekle',
  aliases: ['mesai-add'],
  description: 'Bir kullanıcıya mesai süresi ekler.',
  category: 'Mesai',
  system: 'mesai',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Hedef kullanıcı' },
    { name: 'dakika', type: 'number', required: true, description: 'Eklenecek dakika (negatif olabilir)' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const arg = ctx.args.kullanici;
    const target = arg?.user ?? arg;
    const minutes = Number(ctx.args.dakika);
    if (!Number.isFinite(minutes)) {
      await ctx.reply(errorTemplate(t('shift.invalid_minutes_title'), [t('shift.invalid_minutes')]));
      return;
    }
    const lib = await import('../lib/shifts.js');
    const result = await lib.adjustShift(ctx.guild.id, target.id, minutes * 60);
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('shift.target_missing_title'), [t('shift.target_missing')]));
      return;
    }
    await ctx.reply(
      card({
        emojiKey: 'MESAI',
        title: t('shift.adjusted_title'),
        lines: [t('shift.adjusted', { kullanici: `<@${target.id}>`, dakika: minutes })],
        accent: 'success',
      }),
    );
  },
};
