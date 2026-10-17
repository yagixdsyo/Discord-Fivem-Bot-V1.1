/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';

export default {
  name: 'ses-aktif',
  aliases: ['aktif-ses'],
  description: 'Yetkili ses aktifligini listeler.',
  category: 'Mesai',
  system: 'mesai',
  cooldown: 5,
  permission: { discord: [] },
  args: [{ name: 'tur', type: 'string', required: false, description: 'giris-disi|none' }],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/shifts.js');
    const rows = await lib.listActiveShifts(ctx.guild.id);
    const lines = [];
    for (const entry of rows) {
      const member = await ctx.guild.members.fetch(entry.user_id).catch(() => null);
      const chan = member?.voice?.channel;
      lines.push(
        t('mesai.active_voice_line', {
          kullanici: member ? `<@${entry.user_id}>` : entry.user_id,
          kanal: chan ? `<#${chan.id}>` : t('mesai.offline_discount'),
          sure: lib.formatDuration(Math.max(0, (Date.now() - new Date(entry.started_at).getTime()) / 1000)),
        }),
      );
    }
    if (!lines.length) {
      await ctx.reply(errorTemplate(t('shift.no_active_title'), [t('shift.no_active')]));
      return;
    }
    await ctx.reply(
      card({
        emojiKey: 'SES',
        title: t('mesai.active_voice_title'),
        subtitle: t('mesai.active_voice_subtitle', { adet: lines.length }),
        lines,
        accent: 'info',
      }),
    );
  },
};
