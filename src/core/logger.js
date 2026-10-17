/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import pino from 'pino';

/**
 * Uygulama logger'i (pino).
 * - Uretimde sade JSON, gelistirmede renkli (pino-pretty).
 * - Sirlar (token, sifre, baglanti adresleri) redact ile maskelenir.
 */

let logger = null;

export function createLogger({ level = 'info', pretty = false } = {}) {
  const options = {
    level,
    base: undefined, // pid/hostname gibi gurultuyu kaldir
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'token',
        '*.token',
        'accessToken',
        '*.accessToken',
        'password',
        '*.password',
        'MONGO_URI',
        'REDIS_URL',
      ],
      censor: '[GIZLI]',
    },
  };

  if (pretty) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(options);
}

/** Logger'i bir kez olusturur ve tum uygulamaya dagitir. */
export function initLogger({ level, pretty } = {}) {
  logger = createLogger({ level, pretty });
  return logger;
}

/** Logger hazir degilse guvenli varsayilanla olusturur (test/CLI icin). */
export function getLogger() {
  if (!logger) {
    logger = createLogger({ level: process.env.LOG_LEVEL || 'info', pretty: false });
  }
  return logger;
}
