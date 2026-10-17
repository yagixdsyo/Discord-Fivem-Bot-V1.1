/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

const BASE_URL = 'https://servers-frontend.fivem.net/api/servers/single/';
const CACHE_TTL_MS = 55_000;

const cache = new Map(); // code -> {at, result}

/** Test izolasyonu. */
export function clearCfxCache() {
  cache.clear();
}

/**
 * Link veya kodu CFX koduna cevirir:
 * - https://cfx.re/join/abc123 -> abc123
 * - cfx.re/join/abc123 -> abc123
 * - abc123 -> abc123
 * @returns {string|null}
 */
export function extractCfxCode(input) {
  const text = String(input ?? '').trim();
  if (!text) return null;
  const link = /cfx\.re\/join\/([a-z0-9]+)/i.exec(text);
  if (link) return link[1].toLowerCase();
  const direct = /^([a-z0-9]{4,12})$/i.exec(text);
  if (direct) return direct[1].toLowerCase();
  return null;
}

/**
 * Sunucu bilgisini ceker.
 * @returns {Promise<{ok: true, name: string|null, players: number, maxPlayers: number, gametype: string|null, mapname: string|null} | {ok: false, error: string}>}
 */
export async function fetchServerInfo(code, { timeoutMs = 7000, fresh = false } = {}) {
  if (!code) return { ok: false, error: 'kod_yok' };

  const hit = cache.get(code);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let result;
  try {
    const res = await fetch(`${BASE_URL}${encodeURIComponent(code)}`, {
      signal: controller.signal,
      headers: { 'user-agent': 'fivem-discord-bot' },
    });
    if (!res.ok) {
      result = { ok: false, error: `http_${res.status}` };
    } else {
      const json = await res.json();
      const data = json?.Data;
      if (!data) {
        result = { ok: false, error: 'veri_yok' };
      } else {
        result = {
          ok: true,
          name: data.hostname ?? null,
          players: Number(data.clients ?? 0),
          maxPlayers: Number(data.svMaxclients ?? data.sv_maxclients ?? 0),
          gametype: data.gametype ?? null,
          mapname: data.mapname ?? null,
        };
      }
    }
  } catch (err) {
    result = { ok: false, error: err?.name === 'AbortError' ? 'zaman_asimi' : String(err?.message ?? err) };
  } finally {
    clearTimeout(timer);
  }

  cache.set(code, { at: Date.now(), result });
  return result;
}

/** cfx.re/join linki uretir. */
export function cfxJoinLink(code) {
  return code ? `https://cfx.re/join/${code}` : null;
}
