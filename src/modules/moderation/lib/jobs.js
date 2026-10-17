/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { emitLog } from '../../logging/lib/emit.js';
import { listPendingTasks, registerTaskHandler, scheduleTask } from './schedule.js';
import { decayDueWarnings, liftPunishment } from './store.js';

export const WARN_DECAY_INTERVAL_MS = 86_400_000;

async function fetchGuild(client, guildId) {
  return client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
}

export function registerModerationJobs(client) {
  registerTaskHandler('unban', async (payload) => {
    const guild = await fetchGuild(client, payload.guildId);
    if (!guild) return;
    await guild.bans.remove(payload.userId, 'Süreli ban sona erdi').catch(() => {});
    await liftPunishment(payload.guildId, payload.caseId, { reason: 'Süre sona erdi' });
    await emitLog(guild, 'log_unban', {
      target: payload.userId,
      lines: ['Süreli ban otomatik olarak açıldı.'],
    }).catch(() => {});
  });

  registerTaskHandler('unmute', async (payload) => {
    await liftPunishment(payload.guildId, payload.caseId, { reason: 'Süre sona erdi' });
    const guild = await fetchGuild(client, payload.guildId);
    if (!guild) return;
    await emitLog(guild, 'log_mute', {
      target: payload.userId,
      lines: ['Süreli susturma otomatik olarak kaldırıldı.'],
    }).catch(() => {});
  });

  registerTaskHandler('whitelist_restore', async (payload) => {
    const guild = await fetchGuild(client, payload.guildId);
    if (!guild) return;
    try {
      const member = payload.userId
        ? guild.members.cache.get(payload.userId) ?? (await guild.members.fetch(payload.userId).catch(() => null))
        : null;
      if (member && payload.roleId && member.roles.cache.has(payload.roleId)) {
        await member.roles.remove(payload.roleId, 'Whitelist cezası sona erdi');
      }
    } catch {
      /* rol alinamadi */
    }
    await liftPunishment(payload.guildId, payload.caseId, { reason: 'Süre sona erdi' });
    await emitLog(guild, 'log_whitelist', {
      target: payload.userId,
      lines: ['Whitelist cezası sona erdi; ceza rolü geri alındı.'],
    }).catch(() => {});
  });

  registerTaskHandler('warn_decay', async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        await decayDueWarnings(guild.id);
      } catch {
        /* tek sunucu hatasi akisi durdurmaz */
      }
    }
    await scheduleTask({ kind: 'warn_decay', runAt: new Date(Date.now() + WARN_DECAY_INTERVAL_MS) });
  });
}

/** Gunluk uyari azaltma gorevini (yoksa) kurar. */
export async function ensureWarnDecayTask() {
  const pending = await listPendingTasks(null, 'warn_decay');
  if (pending.length > 0) return false;
  await scheduleTask({ kind: 'warn_decay', runAt: new Date(Date.now() + WARN_DECAY_INTERVAL_MS) });
  return true;
}
