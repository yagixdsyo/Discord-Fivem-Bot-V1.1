/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';

export default {
  name: 'mesaiye-gir',
  aliases: ['mesai-gir', 'mesai-basla'],
  description: 'Mesai kaydini baslatir (ses kanalinda olmasi gerekir).',
  category: 'Mesai',
  system: 'mesai',
  cooldown: 5,
  permission: { discord: [] },
  args: [],
  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }
    const member = ctx.member;
    const lib = await import('../lib/shifts.js');
    const active = await lib.findActiveShift(ctx.guild.id, ctx.user.id);
    if (active) {
      const sinceSec = Math.floor(new Date(active.started_at).getTime() / 1000);
      await ctx.reply(
        card({
          emojiKey: 'UYARI',
          title: t('shift.already_active_title'),
          lines: [t('shift.already_active', { since: `<t:${sinceSec}:R>` })],
          accent: 'warn',
        }),
      );
      return;
    }
    const result = await lib.startShift({ guild: ctx.guild, member });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('shift.already_active_title'), [t('shift.already_active', { since: '-' })]));
      return;
    }
    const startSec = Math.floor(new Date(result.doc.started_at).getTime() / 1000);
    await ctx.reply(
      card({
        emojiKey: 'MESAI_GIR',
        title: t('shift.started_title'),
        lines: [
          t('shift.started'),
          t('shift.started_time', { zaman: `<t:${startSec}:T>`, kalan: `<t:${startSec}:R>` }),
          t('shift.started_hint'),
        ],
        accent: 'success',
        footer: `\`${result.doc.shift_id}\``,
      }),
    );
  },
};
