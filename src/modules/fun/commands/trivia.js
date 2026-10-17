/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { buildTriviaPayload } from '../lib/games.js';
import { FUN_QUESTIONS } from '../lib/questions.js';

export default {
  name: 'trivia',
  aliases: ['fivem-trivia', 'bilgi-yarisi'],
  description: 'FiveM odakli trivia butonlari ve puanlama.',
  category: 'Eglence',
  system: null,
  cooldown: 3,
  permission: { discord: [] },
  args: [],
  async run(ctx) {
    const index = Math.floor(Math.random() * FUN_QUESTIONS.length);
    await ctx.reply(buildTriviaPayload(ctx.t, FUN_QUESTIONS[index], index));
  },
};
