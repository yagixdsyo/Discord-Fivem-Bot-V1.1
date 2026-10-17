/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getLogger } from '../../../core/logger.js';
import { createTranslator } from '../../../locales/index.js';
import { getPresenceConfig, runPresenceCheck } from './presenceCheck.js';

let timer = null;

export function startPresenceLoop(client, { intervalMs = 60_000 } = {}) {
  stopPresenceLoop();
  const tick = () => {
    tickPresenceAll(client).catch((err) => getLogger().debug({ err: err?.message }, 'durum kontrol dongusu hatasi'));
  };
  timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
}

export function stopPresenceLoop() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Tum sunuculari dolasir (test edilebilirlik icin ayri). */
export async function tickPresenceAll(client, { t = null, now = Date.now() } = {}) {
  let ran = 0;
  for (const guild of client.guilds.cache.values()) {
    try {
      const result = await tickPresenceGuild(guild, { t, now });
      if (result?.ok) ran += 1;
    } catch (err) {
      getLogger().debug({ err: err?.message, guild: guild.id }, 'durum kontrolu: sunucu atlandi');
    }
  }
  return { ran };
}

/** Tek sunucu: ayarliysa ve aralik dolduysa kontrol eder. */
export async function tickPresenceGuild(guild, { t = null, now = Date.now() } = {}) {
  const cfg = await getPresenceConfig(guild.id);
  if (!cfg.enabled || !cfg.channelId) return { skipped: true };
  const tFn = t ?? createTranslator();
  return runPresenceCheck(guild, { t: tFn, config: cfg, now });
}
