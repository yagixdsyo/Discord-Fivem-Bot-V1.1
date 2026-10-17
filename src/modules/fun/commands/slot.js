/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { buildSlotPayload } from '../lib/games.js';

export default {
  name: 'slot',
  aliases: ['slot-machine'],
  description: 'Slot makinesini calistirir.',
  category: 'Eglence',
  system: null,
  cooldown: 3,
  permission: { discord: [] },
  args: [],
  async run(ctx) {
    const payload = await buildSlotPayload(ctx.t, {
      guildId: ctx.guild?.id ?? null,
      userId: ctx.user?.id ?? null,
    });
    await ctx.reply(payload);
  },
};
