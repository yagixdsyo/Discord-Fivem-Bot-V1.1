/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { MongoMemoryServer } from 'mongodb-memory-server';

const port = Number(process.env.DEV_MONGO_PORT || 27017);
const dbName = process.env.DEV_MONGO_DB || 'fivem_bot';

const mongod = await MongoMemoryServer.create({
  instance: { port, dbName },
});

console.log(`[dev-mongo] Hazir: ${mongod.getUri(dbName)}`);
console.log('[dev-mongo] NOT: Bellek ici veritabani; surec kapaninca veriler silinir.');
console.log('[dev-mongo] Durdurmak icin Ctrl+C.');

async function stop() {
  console.log('[dev-mongo] Kapatiliyor...');
  await mongod.stop().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
