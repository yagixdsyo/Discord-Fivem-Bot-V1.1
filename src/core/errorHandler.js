/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getLogger } from './logger.js';

/**
 * Hata kodlari ve global hata yakalama.
 *
 * - Hicbir hata botu cokertmez: unhandledRejection / uncaughtException yakalanir.
 * - Kullaniciya teknik hata gosterilmez; "ERR-XXXXXX" kodu gosterilir.
 * - Detaylar: pino log + Redis son kayitlar + (bagliysa) bot_errors koleksiyonu +
 *   owner log kanali.
 */

export class AppError extends Error {
  /**
   * @param {string} message Teknik mesaj (loga gider)
   * @param {{ userMessage?: string, context?: object, cause?: Error }} [opts]
   */
  constructor(message, opts = {}) {
    super(message, { cause: opts.cause });
    this.name = 'AppError';
    this.userMessage = opts.userMessage ?? null;
    this.context = opts.context ?? {};
  }
}

/** 6 karakterlik benzersiz hata kodu: ERR-8F2A31 */
export function generateErrorCode() {
  const hex = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .toUpperCase()
    .padStart(6, '0');
  return `ERR-${hex}`;
}

const MEMORY_LIMIT = 200;
const memoryErrors = [];

/** Bu surecte kaydedilen son hatalar (en yeni ilk). */
export function getRecentErrors() {
  return [...memoryErrors];
}

/**
 * Hata kodunu tum kaynaklarda arar: once bellek, sonra Redis, sonra MongoDB.
 * @param {string} code
 */
export async function findErrorByCode(code) {
  const normalized = String(code ?? '').trim().toUpperCase();
  if (!normalized) return null;

  const inMemory = memoryErrors.find((e) => e.code === normalized);
  if (inMemory) return inMemory;

  try {
    const { getRedis, isRedisReady } = await import('./redis.js');
    if (isRedisReady()) {
      const raw = await getRedis().get(`bot:error:${normalized}`);
      if (raw) return JSON.parse(raw);
    }
  } catch {
    /* Redis yoksa sorun degil */
  }

  try {
    const { getDb, isDbReady } = await import('../db/index.js');
    if (isDbReady()) {
      const doc = await getDb().collection('bot_errors').findOne({ code: normalized });
      if (doc) return doc;
    }
  } catch {
    /* DB yoksa sorun degil */
  }

  return null;
}

let notifier = null;

/**
 * Owner log kanalina hata karti gonderen fonksiyonu baglar.
 * @param {(entry: object) => Promise<void>} fn
 */
export function setErrorNotifier(fn) {
  notifier = fn;
}

let guildNotifier = null;

/**
 * Sunucu baglamli hatalari ilgili sunucunun bot-hata-log kanalina kopruler.
 * @param {(entry: object) => Promise<void>} fn
 */
export function setErrorGuildNotifier(fn) {
  guildNotifier = typeof fn === 'function' ? fn : null;
}

/**
 * Hatayi raporlar: kod uretir, loglar, kalici katmanlara yazar, owner'a bildirir.
 * ASLA firlatmaz (kendi icindeki hatalar sessizce yutulur).
 * @param {unknown} error
 * @param {object} [context] { source, guildId, userId, command, extra }
 * @returns {Promise<object>} hata kaydi
 */
export async function reportError(error, context = {}) {
  const logger = getLogger();
  const code = generateErrorCode();
  const err = error instanceof Error ? error : new Error(String(error));

  const entry = {
    code,
    name: err.name,
    message: err.message,
    stack: (err.stack ?? '').split('\n').slice(0, 20).join('\n'),
    userMessage: err instanceof AppError ? err.userMessage : null,
    context: {
      source: context.source ?? 'bilinmiyor',
      guildId: context.guildId ?? null,
      userId: context.userId ?? null,
      command: context.command ?? null,
      ...(context.extra ?? {}),
    },
    at: new Date().toISOString(),
  };

  // 1) Logger
  try {
    logger.error(
      {
        code,
        source: entry.context.source,
        guildId: entry.context.guildId,
        userId: entry.context.userId,
        command: entry.context.command,
        err: { name: err.name, message: err.message, stack: entry.stack },
      },
      `Hata yakalandi: ${code}`,
    );
  } catch {
    /* logger hatasi yutulur */
  }

  // 2) Bellek (her zaman)
  memoryErrors.unshift(entry);
  if (memoryErrors.length > MEMORY_LIMIT) memoryErrors.length = MEMORY_LIMIT;

  // 3) Redis (hizli erisim, 7 gun)
  try {
    const { getRedis, isRedisReady } = await import('./redis.js');
    if (isRedisReady()) {
      await getRedis().set(`bot:error:${code}`, JSON.stringify(entry), 'EX', 7 * 24 * 3600);
    }
  } catch {
    /* yut */
  }

  // 4) MongoDB (kalici, TTL 30 gun - migration indexi)
  try {
    const { getDb, isDbReady } = await import('../db/index.js');
    if (isDbReady()) {
      await getDb().collection('bot_errors').insertOne({ ...entry });
    }
  } catch {
    /* yut */
  }

  // 5) Owner bildirimi
  if (notifier) {
    try {
      await notifier(entry);
    } catch {
      /* yut */
    }
  }

  // 5b) Sunucu log kopru (bot-hata-log kanali)
  if (guildNotifier && entry.context.guildId) {
    try {
      await guildNotifier(entry);
    } catch {
      /* yut */
    }
  }

  return entry;
}

/** Surec seviyesi global yakalayicilar: hicbir hata sureci cokertmez. */
export function installProcessHandlers() {
  const logger = getLogger();

  process.on('unhandledRejection', (reason) => {
    void reportError(reason, { source: 'unhandledRejection' });
  });

  process.on('uncaughtException', (err) => {
    void reportError(err, { source: 'uncaughtException' });
  });

  process.on('warning', (warning) => {
    logger.warn({ name: warning.name, message: warning.message }, 'Node uyarisi');
  });
}
