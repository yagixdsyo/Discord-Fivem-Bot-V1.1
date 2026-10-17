/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../db/index.js';
import { getRedis, isRedisReady } from './redis.js';

const modules = new Map();

export function registerModule(def) {
  modules.set(def.id, def);
}

export function getModule(moduleId) {
  return modules.get(moduleId) ?? null;
}

export function listModules() {
  return [...modules.values()];
}

function cacheKey(guildId, moduleId) {
  return `mod:${guildId}:${moduleId}`;
}

/**
 * @param {{guildId?: string|null, moduleId: string}} opts
 * @returns {Promise<boolean>}
 */
export async function isModuleActive({ guildId, moduleId }) {
  const def = modules.get(moduleId);
  if (!def) return false;
  if (def.coreModule) return true;
  if (!guildId) return true;
  if (!isDbReady()) return def.defaultEnabled !== false;

  const key = cacheKey(guildId, moduleId);
  if (isRedisReady()) {
    const cached = await getRedis().get(key);
    if (cached !== null && cached !== undefined) return cached === '1';
  }

  let enabled = def.defaultEnabled !== false;
  try {
    const doc = await getCollection('guild_modules').findOne({ guild_id: guildId, module_id: moduleId });
    if (doc) {
      enabled = Boolean(doc.enabled);
    } else {
      // Global kapatma/acma (owner !modül-kapat global) tum sunuculari etkiler
      const globalDoc = await getCollection('guild_modules').findOne({ guild_id: 'global', module_id: moduleId });
      if (globalDoc) enabled = Boolean(globalDoc.enabled);
    }
  } catch {
    /* DB hatasi: varsayilana don */
  }

  if (isRedisReady()) await getRedis().set(key, enabled ? '1' : '0', 'EX', 60);
  return enabled;
}

/**
 * Modul ac/kapat (/sistemkapat, /sistemaç, owner komutlari).
 * guildId 'global' verilirse kapatma tum sunuculari etkiler.
 */
export async function setModuleEnabled({ guildId, moduleId, enabled, by = null, reason = null }) {
  const def = modules.get(moduleId);
  if (!def) return { ok: false, error: 'modul_yok' };
  if (def.coreModule) return { ok: false, error: 'core_modul_kapatilamaz' };
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };

  const now = new Date().toISOString();
  await getCollection('guild_modules').updateOne(
    { guild_id: guildId, module_id: moduleId },
    {
      $set: {
        enabled: Boolean(enabled),
        disabled_by: enabled ? null : by,
        disabled_reason: enabled ? null : reason,
        updated_at: now,
      },
      $setOnInsert: { created_at: now },
    },
    { upsert: true },
  );

  if (isRedisReady()) await getRedis().set(cacheKey(guildId, moduleId), enabled ? '1' : '0', 'EX', 60);
  return { ok: true, enabled: Boolean(enabled) };
}

/** Sunucudaki tum modullerin durum tablosu (V2 tablolar icin). */
export async function getGuildModuleList(guildId) {
  const list = [];
  for (const def of modules.values()) {
    const enabled = await isModuleActive({ guildId, moduleId: def.id });
    list.push({
      id: def.id,
      name: def.name ?? def.id,
      coreModule: Boolean(def.coreModule),
      defaultEnabled: def.defaultEnabled !== false,
      enabled,
    });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}
