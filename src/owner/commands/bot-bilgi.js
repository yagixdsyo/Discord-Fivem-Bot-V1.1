/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import os from 'node:os';
import { getDb, isDbReady } from '../../db/index.js';
import { getRedis, isRedisReady } from '../../core/redis.js';
import { listModules } from '../../core/moduleRegistry.js';
import { getGlobalGateState } from '../../core/ownerGate.js';
import { formatDuration } from '../../core/argParser.js';
import { VERSION } from '../../core/version.js';
import { kv } from '../../ui/templates/index.js';

function untilText(until) {
  if (!until) return '';
  return ` (<t:${Math.floor(Number(until) / 1000)}:R>)`;
}

export default {
  name: 'bot-bilgi',
  description: 'Bot sürümü, sağlık durumu ve istatistikleri.',
  category: 'Bot',

  async run(ctx) {
    const t = ctx.t;
    const client = ctx.client;
    const mem = process.memoryUsage();

    // Pingler
    const wsPing = `${Math.round(client.ws?.ping ?? -1)}ms`;

    let dbPing = t('owner.value_none');
    if (isDbReady()) {
      try {
        const start = Date.now();
        await getDb().command({ ping: 1 });
        dbPing = `${Date.now() - start}ms`;
      } catch {
        dbPing = t('owner.value_error');
      }
    }

    let redisPing = t('owner.value_none');
    if (isRedisReady()) {
      try {
        const start = Date.now();
        await getRedis().ping();
        redisPing = `${Date.now() - start}ms`;
      } catch {
        redisPing = t('owner.value_error');
      }
    }

    const uptimeMs = client.uptime ?? Math.floor(process.uptime() * 1000);
    const guilds = client.guilds.cache.size;
    const users = client.guilds.cache.reduce((sum, g) => sum + (g.memberCount ?? 0), 0);
    const shardCount = client.shard?.count ?? client.options?.shardCount ?? 1;
    const shardId = (client.shard?.ids?.[0] ?? 0) + 1;
    const modules = listModules();
    const gate = await getGlobalGateState();

    const rows = [
      [t('owner.info.version'), VERSION],
      [t('owner.info.uptime'), formatDuration(uptimeMs)],
      [t('owner.info.ping_ws'), wsPing],
      [t('owner.info.ping_db'), dbPing],
      [t('owner.info.ping_redis'), redisPing],
      [t('owner.info.ram'), `${(mem.rss / 1024 / 1024).toFixed(1)} MB`],
      [t('owner.info.cpu'), `${os.loadavg()[0].toFixed(2)} / ${os.cpus().length}`],
      [t('owner.info.guilds'), String(guilds)],
      [t('owner.info.users'), String(users)],
      [t('owner.info.shard'), `${shardId}/${shardCount}`],
      [t('owner.info.modules'), `${modules.length} (${modules.map((m) => m.id).join(', ')})`],
      [
        t('owner.info.pause'),
        gate.pause ? `${t('owner.value_active')}${gate.pause.reason ? ` — ${gate.pause.reason}` : ''}` : t('owner.value_none'),
      ],
      [
        t('owner.info.maintenance'),
        gate.maintenance ? `${t('owner.value_active')}${untilText(gate.maintenance.until)}` : t('owner.value_none'),
      ],
      [t('owner.info.queues'), t('owner.info.queue_none')],
    ];

    await ctx.reply(kv({ emojiKey: 'BILGI', title: t('owner.info.title'), rows, accent: 'info' }));
  },
};
