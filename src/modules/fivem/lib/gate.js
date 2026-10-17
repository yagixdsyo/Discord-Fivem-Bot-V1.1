/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { isSystemActive } from '../../../core/systemRegistry.js';

const cache = new Map(); // `${guildId}:${systemId}` -> {ok, at}
const TTL_MS = 60_000;

export async function systemReady(guildId, systemId) {
  const key = `${guildId}:${systemId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ok;

  let ok = true;
  try {
    ok = await isSystemActive({ guildId, systemId });
  } catch {
    ok = true;
  }
  cache.set(key, { ok, at: Date.now() });
  return ok;
}

/** Test izolasyonu. */
export function clearFivemGate() {
  cache.clear();
}
