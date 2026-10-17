/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { buildAnnouncementView } from '../lib/view.js';

export default {
  name: 'bakım-bilgi',
  aliases: ['bakim-bilgi'],
  description: 'Açık olan son bakım duyurusunu gösterir.',
  category: 'Duyurular',
  cooldown: 5,

  async run(ctx) {
    await ctx.reply(await buildAnnouncementView(ctx, 'bakim'));
  },
};
