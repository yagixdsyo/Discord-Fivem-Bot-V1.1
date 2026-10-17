/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, list as listTemplate } from '../../../ui/templates/index.js';

export default {
  name: 'inaktif-tara',
  aliases: [],
  description: 'Inaktif yetkili adaylarini tespit eder.',
  category: 'Mesai',
  system: 'mesai',
  cooldown: 15,
  permission: { discord: ['ManageGuild'] },
  args: [{ name: 'gun', type: 'number', required: false, description: 'Gun sayısı (varsayılan 14)' }],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/shifts.js');
    const gun = Math.max(1, Math.min(90, Number(ctx.args.gun) || 14));
    const scan = await lib.closeOpenShiftsForInactive(ctx.guild, gun);
    const lines = scan.inactiveCandidates.length
      ? scan.inactiveCandidates.map((id) => t('mesai.inactive_line', { kullanici: `<@${id}>`, gun }))
      : [t('mesai.no_inactive')];
    await ctx.reply(listTemplate({ title: t('mesai.inactive_scan_title', { gun }), lines }));
  },
};
