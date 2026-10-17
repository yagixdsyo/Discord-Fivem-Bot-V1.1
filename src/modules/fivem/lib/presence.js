/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

const guilds = new Map(); // guildId -> Map<key, { id, name, identifiers, at }>
const seen = new Map(); // guildId -> son giris olayi zamani (webhook aktif mi?)

function keyOf(player) {
  if (player?.id !== undefined && player?.id !== null && player?.id !== '') return `id:${player.id}`;
  if (player?.identifiers?.length) return `kimlik:${player.identifiers[0]}`;
  if (player?.name) return `isim:${player.name}`;
  return null;
}

function ensure(guildId) {
  let map = guilds.get(guildId);
  if (!map) {
    map = new Map();
    guilds.set(guildId, map);
  }
  return map;
}

/** Giris olayini kaydeder; basariliysa true. */
export function recordPlayerJoin(guildId, player) {
  const key = keyOf(player);
  if (!guildId || !key) return false;
  ensure(guildId).set(key, {
    id: player?.id !== undefined && player?.id !== null ? String(player.id) : null,
    name: player?.name ?? null,
    identifiers: player?.identifiers ?? [],
    at: new Date().toISOString(),
  });
  seen.set(guildId, Date.now());
  return true;
}

/** Cikis olayini kaydeder; kayit silindiyse true. */
export function recordPlayerLeave(guildId, player) {
  const key = keyOf(player);
  if (!guildId || !key) return false;
  const map = guilds.get(guildId);
  if (!map) return false;
  if (map.delete(key)) return true;
  // id degismisse kimlik/isimle esleyerek temizle (webhook tutarliligi icin).
  if (player?.identifiers?.length) {
    for (const [k, v] of map) {
      if (v.identifiers?.some((i) => player.identifiers.includes(i))) {
        map.delete(k);
        return true;
      }
    }
  }
  if (player?.name) {
    for (const [k, v] of map) {
      if (v.name === player.name) {
        map.delete(k);
        return true;
      }
    }
  }
  return false;
}

/** Sunucuda takip edilen cevrimici oyuncular. */
export function listOnlinePlayers(guildId) {
  const map = guilds.get(guildId);
  return map ? [...map.values()] : [];
}

/** Cevrimici oyuncu sayisi. */
export function onlineCount(guildId) {
  return guilds.get(guildId)?.size ?? 0;
}

/** Webhook'tan en az bir giris olayi geldiyse true (takip aktif). */
export function hasPresenceData(guildId) {
  return seen.has(guildId);
}

/** Discord kimligine gore cevrimici oyuncuyu bulur. */
export function findOnlineByDiscordId(guildId, discordId) {
  const map = guilds.get(guildId);
  if (!map || !discordId) return null;
  const needle = `discord:${discordId}`;
  for (const v of map.values()) {
    if (v.identifiers?.some((i) => i === needle || i.endsWith(`:${needle}`) || i.endsWith(needle))) return v;
  }
  return null;
}

/** Test/temizlik icin kayitlari siler (guildId verilmezse tumu). */
export function clearPresence(guildId) {
  if (guildId) {
    guilds.delete(guildId);
    seen.delete(guildId);
  } else {
    guilds.clear();
    seen.clear();
  }
}
