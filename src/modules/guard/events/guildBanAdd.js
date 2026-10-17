/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor, recordAndLog } from '../lib/pipeline.js';
import { getRedis, isRedisReady } from '../../../core/redis.js';

const LIST_CAP = 10;
const memBans = new Map(); // key -> {ids: string[], resetAt: number}

function keyFor(guildId, actorId) {
  return `guard:banlog:${guildId}:${actorId}`;
}

async function pushBanRecord(guildId, actorId, userId, windowSec) {
  if (isRedisReady()) {
    try {
      const redis = getRedis();
      const key = keyFor(guildId, actorId);
      await redis.rpush(key, userId);
      await redis.ltrim(key, -LIST_CAP, -1);
      await redis.expire(key, Math.max(60, windowSec * 2));
      return;
    } catch {
      /* bellek */
    }
  }
  const key = keyFor(guildId, actorId);
  const now = Date.now();
  let entry = memBans.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { ids: [], resetAt: now + Math.max(60, windowSec * 2) * 1000 };
    memBans.set(key, entry);
  }
  entry.ids.push(userId);
  if (entry.ids.length > LIST_CAP) entry.ids = entry.ids.slice(-LIST_CAP);
}

async function readBanRecords(guildId, actorId) {
  if (isRedisReady()) {
    try {
      return await getRedis().lrange(keyFor(guildId, actorId), 0, -1);
    } catch {
      /* bellek */
    }
  }
  return memBans.get(keyFor(guildId, actorId))?.ids ?? [];
}

async function clearBanRecords(guildId, actorId) {
  memBans.delete(keyFor(guildId, actorId));
  if (isRedisReady()) {
    try {
      await getRedis().del(keyFor(guildId, actorId));
    } catch {
      /* yut */
    }
  }
}

export default {
  name: 'guildBanAdd',
  async execute(ban, meta) {
    const guild = ban?.guild;
    if (!guild) return;

    const { ok } = await guardGate(guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(guild.id);
    const cfg = config.modules.ban_kick;
    if (!cfg.enabled) return;

    const actorResult = await judgeActor({
      guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'ban_kick',
      auditType: AuditLogEvent.MemberBanAdd,
      targetId: ban.user.id,
      force: true,
    });

    // Guvenli/sahip/bot disindaki aktorler icin pencere kaydi tut
    if (actorResult?.actorId && !actorResult.safe && !actorResult.owner && !actorResult.self) {
      await pushBanRecord(guild.id, actorResult.actorId, ban.user.id, cfg.window);
    }

    await handleViolation({
      guild,
      client: meta?.client,
      config,
      moduleKey: 'ban_kick',
      type: 'member_ban',
      description: `Ban: **${ban.user.username}** (\`${ban.user.id}\`)`,
      target: `<@${ban.user.id}>`,
      actorResult,
      restoreFn: async () => {
        if (!actorResult.actorId) return { ok: false, error: 'aktör yok' };
        const ids = new Set([...(await readBanRecords(guild.id, actorResult.actorId)), ban.user.id]);
        let unbanned = 0;
        for (const userId of ids) {
          try {
            await guild.members.unban(userId, 'Guard: toplu ban geri alındı');
            unbanned += 1;
          } catch {
            /* tek ban hatasi akisi durdurmaz */
          }
        }
        await clearBanRecords(guild.id, actorResult.actorId);
        return unbanned > 0
          ? { ok: true, target: `${unbanned} ban geri açıldı` }
          : { ok: false, error: 'banlar geri açılamadı' };
      },
    });
  },
};
