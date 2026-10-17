/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { buildAnnouncementView } from '../lib/view.js';

export default {
  name: 'güncelleme',
  aliases: ['guncelleme'],
  description: 'Açık olan son güncelleme duyurusunu gösterir.',
  category: 'Duyurular',
  cooldown: 5,

  async run(ctx) {
    await ctx.reply(await buildAnnouncementView(ctx, 'guncelleme'));
  },
};
