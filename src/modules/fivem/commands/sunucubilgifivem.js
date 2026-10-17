/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getChannelId } from '../lib/maps.js';
import { fetchServerInfo } from '../lib/cfx.js';
import { getCfx } from '../lib/state.js';
import { serverInfoPayload } from '../lib/view.js';

export default {
  name: 'sunucu-bilgi-fivem',
  aliases: ['sunucubilgifivem'],
  description: 'FiveM sunucu bilgileri, hızlı giriş ve whitelist adımları.',
  category: 'FiveM',
  system: 'fivem_durum',
  cooldown: 10,
  permission: { discord: [] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    const cfx = await getCfx(ctx.guild.id);
    const info = cfx.code ? await fetchServerInfo(cfx.code).catch(() => null) : null;
    const rulesChannel = await getChannelId(ctx.guild.id, 'kurallar').catch(() => null);
    const rulesChannelName = rulesChannel
      ? (ctx.guild.channels.cache.get(rulesChannel)?.name ?? null)
      : null;
    const presence = await import('../lib/presence.js');
    const trackedOnline = presence.hasPresenceData(ctx.guild.id) ? presence.onlineCount(ctx.guild.id) : null;

    await ctx.reply(await serverInfoPayload(t, {
      guild: ctx.guild,
      cfx,
      info,
      ip: cfx.ip,
      rulesChannel,
      rulesChannelName,
      trackedOnline,
    }));
  },
};
