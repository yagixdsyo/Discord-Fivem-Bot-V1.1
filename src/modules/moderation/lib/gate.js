/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { isSystemActive } from '../../../core/systemRegistry.js';

const cache = new Map(); // guildId -> {ok, at}
const TTL_MS = 60_000;

export async function moderationActive(guildId) {
  const hit = cache.get(guildId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ok;

  let ok = true;
  try {
    ok = await isSystemActive({ guildId, systemId: 'moderasyon' });
  } catch {
    ok = true;
  }
  cache.set(guildId, { ok, at: Date.now() });
  return ok;
}

/** Test izolasyonu. */
export function clearGateCache() {
  cache.clear();
}
