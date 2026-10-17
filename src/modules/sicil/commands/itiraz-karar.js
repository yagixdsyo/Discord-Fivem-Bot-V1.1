/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';

export default {
  name: 'itiraz-karar',
  aliases: [],
  description: 'Bekleyen itirazi onaylar veya reddeder.',
  category: 'Ceza ve Sicil',
  system: 'sicil',
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'karar', type: 'string', required: false, description: 'liste|onay|red' },
    { name: 'itiraz_id', type: 'string', required: false, description: 'Itiraz ID' },
    { name: 'sebep', type: 'rest', required: false, description: 'Not' },
  ],
  async run(ctx) {
    const lib = await import('../lib/cases.js');
    const t = ctx.t;
    const karar = String(ctx.args.karar || 'liste').toLowerCase();
    if (karar === 'liste') {
      const rows = await lib.listAppeals(ctx.guild.id, { status: 'beklemede', limit: 20 });
      const lines = rows.map((a) => `${a.appeal_id} | ${a.case_id} | <@${a.user_id}> | ${a.reason}`);
      await ctx.reply(lines.length ? listTemplate({ title: t('ceza.appeal_list_title'), lines }) : success(t('ceza.appeal_list_empty_title'), [t('ceza.appeal_list_empty')]));
      return;
    }
    const appealId = String(ctx.args.itiraz_id || '').trim();
    if (!appealId || !['onay', 'red'].includes(karar)) {
      await ctx.reply(errorTemplate(t('ceza.appeal_decision_input_title'), [t('ceza.appeal_decision_input')]));
      return;
    }
    const result = await lib.reviewAppeal({ guildId: ctx.guild.id, appealId, reviewerId: ctx.user.id, approved: karar === 'onay', note: ctx.args.sebep || null });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('ceza.appeal_decision_fail_title'), [t('ceza.appeal_decision_fail')]));
      return;
    }
    await ctx.reply(success(t('ceza.appeal_decision_done_title'), [t('ceza.appeal_decision_done', { id: appealId, karar })]));
  },
};
