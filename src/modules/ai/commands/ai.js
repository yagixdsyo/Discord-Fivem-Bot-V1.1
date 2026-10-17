/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';

const VALID_MODES = ['genel', 'fivem', 'kod', 'sql', 'guvenlik', 'aciklama'];

export default {
  name: 'ai',
  aliases: ['ai-talk', 'yz'],
  description: 'AI asistana soru sor (yetkili sohbet ve FiveM kod yardimi).',
  category: 'AI',
  system: null,
  cooldown: 5,
  permission: { discord: [] },
  args: [
    { name: 'mod', type: 'string', required: false, description: 'genel|fivem|kod|sql|guvenlik|aciklama' },
    { name: 'soru', type: 'rest', required: false, description: 'Soru ya da istek' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const ai = await import('../index.js');
    let mode = String(ctx.args.mod || '').toLowerCase();
    let prompt = String(ctx.args.soru || '').trim();
    if (!VALID_MODES.includes(mode)) {
      prompt = [ctx.args.mod, ctx.args.soru].filter(Boolean).join(' ').trim();
      mode = 'fivem';
    }
    if (!prompt) {
      await ctx.reply(errorTemplate(t('ai.empty_title'), [t('ai.empty')]));
      return;
    }
    const client = (await import('../lib/client.js')).createAiClient(process.env);
    if (!client.isConfigured()) {
      await ctx.reply(errorTemplate(t('ai.not_configured_title'), [t('ai.not_configured')]));
      return;
    }
    await ctx.deferReply({ ephemeral: false });
    try {
      const result = await ai.askAi({ userId: ctx.user.id, prompt, mode, useFivemContext: true });
      if (!result.ok) {
        if (result.reason === 'rate_limited') await ctx.editReply(errorTemplate(t('ai.rate_limit_title'), [t('ai.rate_limit')]));
        else await ctx.editReply(errorTemplate(t('ai.empty_title'), [t('ai.empty')]));
        return;
      }
      await ctx.editReply(success(t('ai.answer_title'), [result.answer.slice(0, 1900)]));
    } catch (error) {
      await ctx.editReply(errorTemplate(t('ai.error_title'), [t('ai.error', { hata: String(error?.message || error).slice(0, 400) })]));
    }
  },
};
