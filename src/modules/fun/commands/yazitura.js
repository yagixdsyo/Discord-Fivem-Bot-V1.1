/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { buildCoinPayload } from '../lib/games.js';

export default {
  name: 'yazi-tura',
  aliases: ['coinflip'],
  description: 'Yazi tura atar.',
  category: 'Eglence',
  system: null,
  cooldown: 2,
  permission: { discord: [] },
  args: [],
  async run(ctx) {
    const payload = await buildCoinPayload(ctx.t);
    await ctx.reply(payload);
  },
};
