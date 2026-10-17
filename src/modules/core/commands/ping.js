/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { info as infoTemplate } from '../../../ui/templates/index.js';
import { formatDuration } from '../../../core/argParser.js';
import { getDb, isDbReady } from '../../../db/index.js';
import { getRedis, isRedisReady } from '../../../core/redis.js';

export default {
  name: 'ping',
  description: 'Bot gecikmesini ve baglanti durumunu gosterir.',
  cooldown: 3,
  guildOnly: false,

  async run(ctx) {
    const t = ctx.t;
    const client = ctx.client;

    // 1) WebSocket ping
    const wsPing =
      typeof client?.ws?.ping === 'number' && client.ws.ping >= 0
        ? Math.round(client.ws.ping)
        : null;

    // 2) MongoDB ping
    let dbMs = null;
    if (isDbReady()) {
      const start = performance.now();
      try {
        await getDb().command({ ping: 1 });
        dbMs = Math.round(performance.now() - start);
      } catch {
        dbMs = null;
      }
    }

    // 3) Redis ping
    let redisMs = null;
    if (isRedisReady()) {
      const start = performance.now();
      try {
        const pong = await getRedis().ping();
        if (pong === 'PONG') redisMs = Math.round(performance.now() - start);
      } catch {
        redisMs = null;
      }
    }

    const lines = [
      t('ping.websocket', { ms: wsPing ?? '?' }),
      t('ping.database', { ms: dbMs ?? '?' }),
      t('ping.redis', { ms: redisMs ?? '?' }),
      t('ping.uptime', { sure: formatDuration(client?.uptime ?? 0) }),
    ];

    if (client?.shard) {
      lines.push(t('ping.shard', { shard: `${client.shard.ids.join(',')}/${client.shard.count}` }));
    }

    await ctx.reply(infoTemplate(t('ping.title'), lines));
  },
};
