/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';

export default {
  name: 'ai-analiz',
  aliases: ['hata-analiz'],
  description: 'AI ile stack trace/hata mesajini analiz eder.',
  category: 'AI',
  system: null,
  cooldown: 5,
  permission: { discord: [] },
  args: [{ name: 'hata', type: 'rest', required: false, description: 'Hata metni' }],
  async run(ctx) {
    const t = ctx.t;
    const prompt = String(ctx.args.hata || '').trim();
    if (!prompt) { await ctx.reply(errorTemplate(t('ai.empty_title'), ['Hata metni girin.'])); return; }
    await ctx.deferReply({ ephemeral: false });
    const ai = await import('../index.js');
    const client = (await import('../lib/client.js')).createAiClient(process.env);
    if (!client.isConfigured()) { await ctx.editReply(errorTemplate(t('ai.not_configured_title'), [t('ai.not_configured')])); return; }
    const result = await ai.askAi({ userId: ctx.user.id, prompt: 'Bu hata/stack trace analiz edilsin: ' + prompt, mode: 'kod', useFivemContext: true, temperature: 0.2 });
    if (!result.ok) return await ctx.editReply(errorTemplate(t('ai.empty_title'), [t('ai.empty')]));
    await ctx.editReply(success(t('ai.answer_title'), [result.answer.slice(0, 1900)]));
  },
};
