/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { buildGuildDetailCard } from '../lib/report.js';
import { resolveTargetGuild } from '../lib/guildResolve.js';

export default {
  name: 'bot-detay',
  description: 'Bir sunucunun tam raporunu gösterir.',
  category: 'Sunucu',
  args: [
    {
      name: 'sunucu',
      type: 'string',
      required: false,
      description: 'Sunucu ID veya adı (boşsa bulunduğunuz sunucu)',
    },
  ],

  async run(ctx) {
    const guild = await resolveTargetGuild(ctx, ctx.args.sunucu, { required: false });
    if (!guild) return;

    const card = await buildGuildDetailCard({ guild, t: ctx.t });
    await ctx.reply(card);
  },
};
