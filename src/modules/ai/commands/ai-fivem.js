/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';

export default {
  name: 'ai-fivem',
  aliases: ['fivem-ai', 'fivem-yardim'],
  description: 'FiveM CfxRE/CfxLua/ESX/QBCore kod yardimi alir.',
  category: 'AI',
  system: null,
  cooldown: 5,
  permission: { discord: [] },
  args: [{ name: 'konu', type: 'rest', required: true, description: 'FiveM kod/konfig sorusu' }],
  async run(ctx) {
    const t = ctx.t;
    const client = (await import('../lib/client.js')).createAiClient(process.env);
    if (!client.isConfigured()) {
      await ctx.reply(errorTemplate(t('ai.not_configured_title'), [t('ai.not_configured')]));
      return;
    }
    await ctx.deferReply({ ephemeral: false });
    try {
      const result = (await import('../index.js')).askAi;
      const prompt = `FiveM CfxRE odakli soru: ${ctx.args.konu}`;
      const answer = await result({ userId: ctx.user.id, prompt, useFivemContext: true });
      if (!answer.ok) {
        await ctx.editReply(errorTemplate(t('ai.empty_title'), [t('ai.empty')]));
        return;
      }
      await ctx.editReply(success(t('ai.fivem_title'), [answer.answer.slice(0, 1900)]));
    } catch (error) {
      await ctx.editReply(errorTemplate(t('ai.error_title'), [t('ai.error', { hata: String(error?.message || error).slice(0,400) })]));
    }
  },
};
