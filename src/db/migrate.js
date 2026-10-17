/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getDb, initDatabase, closeDatabase } from './index.js';
import { loadEnv } from '../core/env.js';
import { initLogger, getLogger } from '../core/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export async function loadMigrationModules() {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => /^\d+.*\.js$/.test(f))
    .sort((a, b) => a.localeCompare(b, 'en'));

  const modules = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(MIGRATIONS_DIR, file)).href);
    const migration = mod.default;
    if (!migration || typeof migration.up !== 'function') {
      throw new Error(`Gecersiz migration dosyasi: ${file} (default export { name, up, down } olmali)`);
    }
    modules.push({ file, ...migration, name: migration.name ?? file.replace(/\.js$/, '') });
  }
  return modules;
}

/**
 * Bekleyen migration'lari uygular veya son uygulanani geri alir.
 * @param {import('mongodb').Db} db
 * @param {import('pino').Logger} logger
 * @param {{ down?: boolean }} [opts]
 * @returns {Promise<{ applied: string[], reverted: string|null }>}
 */
export async function runMigrations(db, logger = getLogger(), { down = false } = {}) {
  const registry = db.collection('_migrations');
  const migrations = await loadMigrationModules();
  const appliedDocs = await registry.find({}).sort({ _id: 1 }).toArray();
  const appliedNames = appliedDocs.map((d) => d._id);

  if (down) {
    const last = appliedNames[appliedNames.length - 1];
    if (!last) {
      logger.info('Geri alinacak migration yok.');
      return { applied: [], reverted: null };
    }
    const target = migrations.find((m) => m.name === last);
    if (!target) {
      throw new Error(`Geri alinacak migration dosyasi bulunamadi: ${last}`);
    }
    if (typeof target.down === 'function') {
      logger.warn({ migration: last }, 'Migration geri aliniyor (down)');
      await target.down(db, logger);
    } else {
      logger.warn({ migration: last }, 'Bu migration down() tanimlamiyor; sadece kayit siliniyor.');
    }
    await registry.deleteOne({ _id: last });
    logger.info({ migration: last }, 'Migration geri alindi');
    return { applied: [], reverted: last };
  }

  const applied = [];
  for (const migration of migrations) {
    if (appliedNames.includes(migration.name)) continue;
    const startedAt = Date.now();
    await migration.up(db, logger);
    await registry.insertOne({
      _id: migration.name,
      file: migration.file,
      applied_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
    });
    applied.push(migration.name);
    logger.info({ migration: migration.name }, 'Migration uygulandi');
  }

  if (applied.length === 0) {
    logger.info('Bekleyen migration yok; sema guncel.');
  }

  return { applied, reverted: null };
}

/** CLI girisi: migration'lari uygular/geri alir ve cikar. */
async function main() {
  const { config } = loadEnv({ requireBots: false });
  const logger = initLogger({
    level: config.logLevel,
    pretty: config.nodeEnv !== 'production',
  });

  await initDatabase(config.mongo, logger);

  const down = process.argv.includes('--down');
  const result = await runMigrations(getDb(), logger, { down });

  if (!down) {
    logger.info({ applied: result.applied }, 'Migration islemi tamamlandi');
  }

  await closeDatabase();
  process.exit(0);
}

// Sadece dogrudan CLI olarak calistirildiginda main kosar (import edilince degil).
const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  main().catch((err) => {
    console.error('Migration hatasi:', err?.message ?? err);
    process.exit(1);
  });
}
