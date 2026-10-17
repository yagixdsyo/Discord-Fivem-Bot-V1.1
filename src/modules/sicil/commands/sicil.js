/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';

export default {
  name: 'sicil',
  aliases: ['sicil-sorgu'],
  description: 'Kullanici veya sunucu son ceza kayitlarini listeler.',
  category: 'Ceza ve Sicil',
  system: 'sicil',
  cooldown: 5,
  permission: { discord: [] },
  args: [{ name: 'kullanici', type: 'user', required: false, description: 'Hedef kullanici' }],
  async run(ctx) {
    const lib = await import('../lib/cases.js');
    const t = ctx.t;
    const target = ctx.args.kullanici?.id ?? ctx.args.kullanici ?? ctx.user.id;
    const rows = await lib.listSanctions(ctx.guild.id, { userId: target, limit: 20 }).catch(() => []);
    if (!rows.length) {
      await ctx.reply(success(t('ceza.sicil_empty_title'), [t('ceza.sicil_empty', { kullanici: `<@${target}>` })]));
      return;
    }
    const lines = rows.map((r) => t('ceza.sicil_line', { id: r.case_id, tur: r.type, sebep: r.reason || '-', durum: r.status, tarih: `<t:${Math.floor(new Date(r.created_at).getTime() / 1000)}:d>` }));
    await ctx.reply(listTemplate({ title: t('ceza.sicil_title', { kullanici: `<@${target}>` }), lines }));
  },
};
