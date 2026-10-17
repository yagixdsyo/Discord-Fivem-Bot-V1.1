/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { MongoClient } from 'mongodb';
import { getLogger } from '../core/logger.js';

/**
 * MongoDB baglantisi (tek instance, koleksiyon tabanli erisim).
 * Tum snowflake'ler TEXT/string olarak saklanir (bigint tasma riski yok).
 */

let client = null;
let db = null;

export function isDbReady() {
  return db !== null;
}

export function getDb() {
  if (!db) {
    throw new Error('MongoDB hazir degil: once initDatabase() cagrilmali.');
  }
  return db;
}

/** @param {string} name koleksiyon adi */
export function getCollection(name) {
  return getDb().collection(name);
}

export async function initDatabase({ uri, dbName }, logger = getLogger()) {
  client = new MongoClient(uri, {
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
    retryWrites: true,
  });

  await client.connect();
  const database = client.db(dbName);
  await database.command({ ping: 1 });

  db = database;
  logger.info({ dbName }, 'MongoDB baglantisi dogrulandi (ping)');
  return db;
}

export async function closeDatabase() {
  if (client) {
    try {
      await client.close();
    } catch {
      /* yut */
    }
    client = null;
    db = null;
  }
}
