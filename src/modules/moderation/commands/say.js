/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { sayPayload } from '../lib/view.js';

export default {
  name: 'say',
  aliases: ['sayac', 'sayaç'],
  description: 'Sunucudaki üye/kanal/rol/boost sayaçlarını gösterir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  args: [],

  async run(ctx) {
    const t = ctx.t;
    const guild = ctx.guild;

    const members = guild.members.cache;
    const counts = {
      guildName: guild.name,
      members: guild.memberCount ?? members.size,
      online: members.filter((member) => !member.user?.bot && member.presence && member.presence.status !== 'offline').size,
      bots: members.filter((member) => member.user?.bot).size,
      channels: guild.channels.cache.size,
      roles: guild.roles.cache.size,
      boosts: guild.premiumSubscriptionCount ?? 0,
      boostTier: guild.premiumTier ?? 0,
      emojis: guild.emojis.cache.size,
    };

    await ctx.reply(sayPayload(t, { counts }));
  },
};
