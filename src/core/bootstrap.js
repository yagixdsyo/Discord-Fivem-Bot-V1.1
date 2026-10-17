/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { loadEnv, EnvValidationError } from './env.js';
import { initLogger } from './logger.js';
import { installProcessHandlers } from './errorHandler.js';
import { initDatabase, closeDatabase, getDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { initRedis, closeRedis, getRedis } from './redis.js';
import { BotInstance } from './BotInstance.js';
import { initColors } from '../ui/colors.js';
import { initEmoji } from '../ui/emoji.js';
import { setDefaultPrefix } from './guildSettings.js';
import { attachInstance, initLoader, teardownInstance } from './loader.js';
import { setLifecycleHandler } from './lifecycle.js';
import { stopUsageStats } from './usageStats.js';
import { setupOwnerHandlers } from '../owner/handlers.js';
import { attachErrorNotifier, setOwnerLogClient } from '../owner/lib/ownerLog.js';
import { startHealthServer, stopHealthServer } from '../web/health.js';
import { VERSION } from './version.js';

/**
 * Bootstrap: env dogrulama -> logger -> DB(+migration) -> Redis -> bot ornekleri -> health.
 * /18: tek giris noktasi, zarif kapanis, hatalarda süreç cokmez.
 */

let shuttingDown = false;

export async function bootstrap() {
  // 1) Env dogrulama
  const { config, warnings } = loadEnv();

  // 2) Logger
  const logger = initLogger({
    level: config.logLevel,
    pretty: config.nodeEnv !== 'production',
  });

  logger.info(
    { version: VERSION, env: config.nodeEnv, bots: config.bots.map((b) => b.type) },
    'FiveM Yonetim Botu baslatiliyor',
  );

  for (const warning of warnings) {
    logger.warn(warning);
  }

  // 3) UI katmani: renkler + emojiler + varsayilan prefix
  initColors(config.colors);
  initEmoji(config.emoji);
  setDefaultPrefix(config.prefix);

  // 4) Global hata yakalayicilar (bundan sonra hicbir hata sureci cokertmez)
  installProcessHandlers();

  // 5) MongoDB + migration
  await initDatabase(config.mongo, logger);
  const migrationResult = await runMigrations(getDb(), logger);
  if (migrationResult.applied.length > 0) {
    logger.info({ applied: migrationResult.applied }, 'Veritabani semasi guncellendi');
  }

  // 6) Redis
  await initRedis({ url: config.redisUrl }, logger);

  // 7) Loader: moduller, komutlar, event'ler
  const loaderSummary = await initLoader();
  logger.info(loaderSummary, 'Loader hazir');

  // 7b) Owner sistemi: panel/bilesen yonlendiricileri (komutlar loader'da yuklendi)
  setupOwnerHandlers({ config, logger });

  // 8) Bot ornekleri (once loader baglanir, sonra giris)
  const bots = [];
  for (const spec of config.bots) {
    const instance = new BotInstance({
      type: spec.type,
      label: spec.label,
      token: spec.token,
      config,
    });
    await attachInstance(instance, { config });
    await instance.start();
    bots.push(instance);
  }

  // Owner log kanali + hata bildirimi (ilk bot uzerinden)
  setOwnerLogClient(bots[0]?.client ?? null);
  attachErrorNotifier(config);

  // 7) Saglik endpointi
  await startHealthServer({
    port: config.healthPort,
    checks: [
      { name: 'mongo', check: async () => { await getDb().command({ ping: 1 }); return true; } },
      { name: 'redis', check: async () => (await getRedis().ping()) === 'PONG' },
      { name: 'botlar', check: () => bots.length > 0 && bots.every((b) => b.isReady()) },
    ],
  });

  // 8) Zarif kapanis (SIGTERM/SIGINT): kuyruklar/paneller korunur, baglantilar kapatilir
  const shutdown = async (signal, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Zarif kapanis basliyor...');
    try {
      await stopHealthServer();
      for (const bot of bots) {
        await teardownInstance(bot);
        await bot.stop();
      }
      await stopUsageStats();
      await closeRedis();
      await closeDatabase();
      logger.info('Zarif kapanis tamamlandi. Goruse kadar!');
    } catch (err) {
      logger.error({ err: err?.message }, 'Kapanis sirasinda hata');
    }
    process.exit(exitCode);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  // Owner komutlarindan kapatma/yeniden baslatma:
  // - 'stop'    -> exit 0: Docker 'restart: on-failure' ile konteyner KAPALI kalir
  // - 'restart' -> exit 1: supervisor (Docker/systemd) sureci geri getirir
  setLifecycleHandler(async (mode, meta = {}) => {
    logger.warn({ mode, ...meta }, 'Owner yasam dongusu istegi alindi');
    setTimeout(
      () => {
        void shutdown(mode === 'restart' ? 'OWNER_RESTART' : 'OWNER_STOP', mode === 'restart' ? 1 : 0);
      },
      1500,
    ).unref?.();
  });

  return { config, logger, bots };
}

export { EnvValidationError };
