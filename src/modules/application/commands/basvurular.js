/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';

export default {
  name: 'basvurular',
  aliases: [],
  description: 'Basvurulari listeler ve inceleme durumlarini gosterir.',
  category: 'Basvuru',
  system: 'basvuru',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'durum', type: 'string', required: false, description: 'beklemede|onaylandi|reddedildi|mulakat' },
    { name: 'tur', type: 'string', required: false, description: 'yetkili|whitelist|legal_ekip|illegal_ekip' },
    { name: 'id', type: 'string', required: false, description: 'Basvuru ID' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/applications.js');
    const durum = ['beklemede', 'onaylandi', 'reddedildi', 'mulakat', 'yasakli'].includes(ctx.args.durum) ? ctx.args.durum : null;
    const tur = ['yetkili', 'whitelist', 'legal_ekip', 'illegal_ekip'].includes(ctx.args.tur) ? ctx.args.tur : null;
    if (ctx.args.id) {
      const app = await lib.getApplication(ctx.guild.id, ctx.args.id);
      if (!app) {
        await ctx.reply(errorTemplate(t('application.not_found_title'), [t('application.not_found', { id: ctx.args.id })]));
        return;
      }
      const lines = [t('application.show_type', { id: app.application_id }), t('application.show_type2', { tur: app.type })];
      for (const [i, x] of (app.answers || []).entries()) lines.push(`**${x.q}**: ${x.a}`);
      lines.push(t('application.show_status', { durum: app.status, inceleyen: app.reviewed_by || '-' }));
      await ctx.reply(listTemplate({ title: t('application.details_title'), lines }));
      return;
    }
    const rows = await lib.listApplications(ctx.guild.id, { type: tur, status: durum, limit: 20 });
    if (!rows.length) {
      await ctx.reply(listTemplate({ title: t('application.list_title'), lines: [t('application.list_empty')] }));
      return;
    }
    const lines = rows.map((a) => t('application.list_line', { id: a.application_id, kullanici: `<@${a.user_id}>`, tur: a.type, durum: a.status }));
    await ctx.reply(listTemplate({ title: t('application.list_title'), lines }));
  },
};
