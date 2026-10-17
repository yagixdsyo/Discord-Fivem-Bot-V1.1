/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';

export default {
  name: 'ai-temizle',
  aliases: ['ai-clear', 'ai-sifirla'],
  description: 'AI sohbet gecmisini ve rate limit sayaclari sifirlar.',
  category: 'AI',
  system: null,
  cooldown: 3,
  permission: { discord: [] },
  args: [],
  async run(ctx) {
    const t = ctx.t;
    const ai = await import('../index.js');
    ai.clearConversation(ctx.user.id);
    const stats = ai.getConversationStats(ctx.user.id);
    await ctx.reply(success(t('ai.cleared_title'), [t('ai.cleared_line', { turns: stats.turns, words: stats.words })]));
  },
};
