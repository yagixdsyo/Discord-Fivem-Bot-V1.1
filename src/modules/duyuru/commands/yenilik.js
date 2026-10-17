/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { buildAnnouncementView } from '../lib/view.js';

export default {
  name: 'yenilik',
  description: 'Açık olan son yenilik duyurusunu gösterir.',
  category: 'Duyurular',
  cooldown: 5,

  async run(ctx) {
    await ctx.reply(await buildAnnouncementView(ctx, 'yenilik'));
  },
};
