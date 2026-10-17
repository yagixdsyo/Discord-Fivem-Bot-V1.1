/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from '../../../ui/templates/base.js';

export default {
  name: 'mesaiden-cik',
  aliases: ['mesai-cik', 'mesai-bitir'],
  description: 'Aktif mesaiyi sonlandirir.',
  category: 'Mesai',
  system: 'mesai',
  cooldown: 5,
  permission: { discord: [] },
  args: [{ name: 'sebep', type: 'rest', required: false, description: 'Kapatma sebebi' }],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/shifts.js');
    const result = await lib.endShift({ guild: ctx.guild, userId: ctx.user.id, reason: ctx.args.sebep || 'manuel' });
    if (!result.ok) {
      await ctx.reply(
        card({
          emojiKey: 'UYARI',
          title: t('shift.not_active_title'),
          lines: [t('shift.not_active')],
          accent: 'warn',
        }),
      );
      return;
    }

    const doc = result.doc;
    const startSec = Math.floor(new Date(doc.started_at).getTime() / 1000);
    const endSec = doc.ended_at ? Math.floor(new Date(doc.ended_at).getTime() / 1000) : null;
    const lines = [
      t('shift.ended'),
      t('shift.ended_duration', { sure: lib.formatDuration(result.durationSeconds) }),
    ];
    if (endSec) {
      lines.push(t('shift.ended_range', { baslangic: `<t:${startSec}:T>`, bitis: `<t:${endSec}:T>` }));
    }

    await ctx.reply(
      card({
        emojiKey: 'MESAI_CIK',
        title: t('shift.ended_title'),
        lines,
        accent: 'success',
        footer: `\`${doc.shift_id}\``,
      }),
    );
  },
};
