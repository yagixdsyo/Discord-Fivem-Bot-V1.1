/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import Redis from 'ioredis';
import { getLogger } from './logger.js';

/**
 * Redis baglantisi (ioredis).
 * - Komut/config onbellegi, cooldown, gecici durumlar bu baglantidan kullanilir.
 * - BullMQ kuyruklari kendi baglantisini ister: createBullConnection kullanin.
 * - Redis erisilemezse bot DURMAZ: initRedis hata firlatmaz, null doner;
 *   onbellek/cooldown katmani devre disi kalir ve DB yedekleriyle devam edilir.
 */

let main = null;

export function isRedisReady() {
  return Boolean(main) && (main.status === 'ready' || main.status === 'connect');
}

export function getRedis() {
  if (!main) {
    throw new Error('Redis hazir degil: once initRedis() cagrilmali.');
  }
  return main;
}

function attachLogging(client, name) {
  const logger = getLogger();
  client.on('error', (err) => {
    logger.error({ err: err.message, connection: name }, 'Redis baglanti hatasi');
  });
  client.on('reconnecting', () => {
    logger.warn({ connection: name }, 'Redis yeniden baglaniyor...');
  });
  client.on('ready', () => {
    logger.info({ connection: name }, 'Redis hazir');
  });
  return client;
}

const INIT_TIMEOUT_MS = 8000;
const INIT_CONNECT_TIMEOUT_MS = 3000;
const INIT_MAX_RETRIES = 8;

/** Uygulama geneli Redis baglantisini baslatir ve PING ile dogrular. */
export async function initRedis({ url, timeoutMs = INIT_TIMEOUT_MS }, logger = getLogger()) {
  // Init surecinde tek tek baglanti hatalari loglanmaz; sonuc tek ozet satiriyla
  // bildirilir (yeniden denemelerde log spam'i olusmasin). Basarili baglantidan
  // sonra attachLogging ile canli hata/uyari loglari devreye girer.
  const client = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: null, // kuyruk/blok islemleri icin sinirsiz deneme
    enableReadyCheck: true,
    connectTimeout: INIT_CONNECT_TIMEOUT_MS,
    retryStrategy: (times) => (times > INIT_MAX_RETRIES ? null : Math.min(times * 300, 2000)),
  });
  const swallow = () => {};
  client.on('error', swallow);
  main = client;

  let timer = null;
  try {
    const ping = client.ping();
    ping.catch(() => {}); // zaman asimi sonrasi reddi yut (unhandled rejection olmaz)
    await Promise.race([
      ping,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Redis PING zaman asimi (${timeoutMs} ms)`)),
          timeoutMs,
        );
      }),
    ]);
    client.off('error', swallow);
    attachLogging(client, 'ana');
    logger.info('Redis baglantisi dogrulandi (PONG)');
    return client;
  } catch (err) {
    logger.warn(
      { err: err?.message },
      'Redis erisilemedi; onbellek/cooldown/kuyruk katmani devre disi. Bot, DB yedekleriyle calismaya devam ediyor.',
    );
    try {
      client.disconnect();
    } catch {
      /* yut */
    }
    main = null;
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** BullMQ icin ayri, bloklamaya uygun baglanti uretir. */
export function createBullConnection({ url }) {
  return attachLogging(
    new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false }),
    'bullmq',
  );
}

/** Zarif kapanis icin baglantiyi kapatir. */
export async function closeRedis() {
  if (main) {
    try {
      await main.quit();
    } catch {
      main.disconnect();
    }
    main = null;
  }
}

// ---------------------------------------------------------------------------
// JSON yardimcilari (onbellek ve gecici durumlar icin)
// Redis hazir degilse no-op: yazma/silme sessizce atlanir, okuma null doner.
// ---------------------------------------------------------------------------

export async function setJSON(key, value, ttlSeconds) {
  if (!isRedisReady()) return null;
  const payload = JSON.stringify(value);
  if (ttlSeconds) return getRedis().set(key, payload, 'EX', ttlSeconds);
  return getRedis().set(key, payload);
}

export async function getJSON(key) {
  if (!isRedisReady()) return null;
  const raw = await getRedis().get(key);
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function delKey(key) {
  if (!isRedisReady()) return 0;
  return getRedis().del(key);
}

/** SCAN ile desene uyan anahtarlari siler (toplu onbellek temizligi). */
export async function deleteByPattern(pattern) {
  if (!isRedisReady()) return 0;
  let deleted = 0;
  try {
    let cursor = '0';
    do {
      const [next, keys] = await getRedis().scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) deleted += await getRedis().del(...keys);
    } while (cursor !== '0');
  } catch {
    /* yut: onbellek temizligi kritik degil */
  }
  return deleted;
}

/** Basit "varsa onbellegi don, yoksa uret ve yaz" yardimcisi. */
export async function cached(key, ttlSeconds, producer) {
  const hit = await getJSON(key);
  if (hit !== null) return hit;
  const value = await producer();
  await setJSON(key, value, ttlSeconds);
  return value;
}
