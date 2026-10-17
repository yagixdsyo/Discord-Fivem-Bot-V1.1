/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { buildDicePayload } from '../lib/games.js';

export default {
  name: 'zar',
  aliases: ['dice'],
  description: 'Zar atar; adet ve yuz sayisini destekler.',
  category: 'Eglence',
  system: null,
  cooldown: 2,
  permission: { discord: [] },
  args: [
    { name: 'adet', type: 'number', required: false, description: 'Atilacak zar sayisi (1-8)' },
    { name: 'yuz', type: 'number', required: false, description: 'Zar yuzu (2-100)' },
  ],
  async run(ctx) {
    const payload = await buildDicePayload(ctx.t, { count: ctx.args.adet, sides: ctx.args.yuz });
    await ctx.reply(payload);
  },
};
