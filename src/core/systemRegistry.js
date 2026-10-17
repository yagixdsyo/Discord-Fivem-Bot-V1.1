/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../db/index.js';
import { getRedis, isRedisReady } from './redis.js';
import { getModule, isModuleActive } from './moduleRegistry.js';

const systems = new Map();

/**
 * Sistem tanimi kaydeder.
 * @param {{ id: string, name: string, moduleId?: string|null, defaultEnabled?: boolean, package?: string|null }} def
 */
export function registerSystem(def) {
  if (!def?.id) return;
  systems.set(def.id, {
    moduleId: null,
    defaultEnabled: true,
    package: null,
    ...def,
  });
}

/** Birden fazla sistem tanimini kaydeder. */
export function registerSystems(list) {
  for (const def of list ?? []) registerSystem(def);
}

export function getSystem(systemId) {
  return systems.get(systemId) ?? null;
}

export function listSystems() {
  return [...systems.values()];
}

/** Test izolasyonu icin: tum sistem kayitlarini temizler. */
export function clearSystems() {
  systems.clear();
}

function cacheKey(guildId, systemId) {
  return `mod:${guildId}:${systemId}`;
}

/** Sistemin KENDI satirini okur (modul katmani haric). */
async function readSystemToggle({ guildId, systemId, defaultEnabled = true }) {
  if (!guildId) return defaultEnabled;
  if (!isDbReady()) return defaultEnabled;

  const key = cacheKey(guildId, systemId);
  if (isRedisReady()) {
    const cached = await getRedis().get(key);
    if (cached !== null && cached !== undefined) return cached === '1';
  }

  let enabled = defaultEnabled;
  try {
    const doc = await getCollection('guild_modules').findOne({ guild_id: guildId, module_id: systemId });
    if (doc) enabled = Boolean(doc.enabled);
  } catch {
    /* DB hatasi: varsayilana don */
  }

  if (isRedisReady()) await getRedis().set(key, enabled ? '1' : '0', 'EX', 60);
  return enabled;
}

/**
 * Sistem bu sunucuda calisiyor mu?
 * @param {{guildId?: string|null, systemId: string}} opts
 * @returns {Promise<boolean>}
 */
export async function isSystemActive({ guildId, systemId }) {
  const def = systems.get(systemId);
  if (!def) return false;

  const moduleId = def.moduleId ?? null;
  if (moduleId) {
    const moduleDef = getModule(moduleId);
    if (moduleDef) {
      const moduleOn = await isModuleActive({ guildId, moduleId });
      if (!moduleOn) return false;
      // Sistem id'si modul id'siyle ayniysa ayni satiri paylasir. Ancak core
      // modullerde modul katmani satiri OKUMAZ (her zaman true); bu yuzden
      // sistem satiri yine de kontrol edilir (guard gibi core sistemler kapatilabilir).
      if (moduleId === def.id && !moduleDef.coreModule) return true;
    }
  }

  return readSystemToggle({
    guildId,
    systemId: def.id,
    defaultEnabled: def.defaultEnabled !== false,
  });
}

/**
 * Sistem ac/kapat.
 * @returns {Promise<{ok: boolean, enabled?: boolean, error?: string}>}
 */
export async function setSystemEnabled({ guildId, systemId, enabled, by = null, reason = null }) {
  const def = systems.get(systemId);
  if (!def) return { ok: false, error: 'sistem_yok' };
  if (!guildId) return { ok: false, error: 'sunucu_yok' };
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };

  const now = new Date().toISOString();
  await getCollection('guild_modules').updateOne(
    { guild_id: guildId, module_id: systemId },
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

  if (isRedisReady()) {
    await getRedis().set(cacheKey(guildId, systemId), enabled ? '1' : '0', 'EX', 60);
  }
  return { ok: true, enabled: Boolean(enabled) };
}

/**
 * Sunucudaki tum sistemlerin durum tablosu (V2 tablolar icin).
 * @returns {Promise<Array<{id: string, name: string, moduleId: string|null, moduleRegistered: boolean, defaultEnabled: boolean, enabled: boolean, package: string|null}>>}
 */
export async function getGuildSystemList(guildId) {
  const list = [];
  for (const def of systems.values()) {
    const moduleId = def.moduleId ?? null;
    const enabled = await isSystemActive({ guildId, systemId: def.id });
    list.push({
      id: def.id,
      name: def.name ?? def.id,
      moduleId,
      moduleRegistered: moduleId ? Boolean(getModule(moduleId)) : false,
      defaultEnabled: def.defaultEnabled !== false,
      enabled,
      package: def.package ?? null,
    });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

/**
 * Komut, modul + sistem katmanlarindan gecerli mi?
 * - command.system tanimliysa sistem katmani (sahip modul dahil) uygulanir.
 * - Aksi halde yalnizca modul katmani uygulanir.
 * @param {{guildId?: string|null, command: object}} opts
 */
export async function isCommandActive({ guildId, command }) {
  if (!command) return true;
  if (command.system) {
    const def = systems.get(command.system);
    if (def) return isSystemActive({ guildId, systemId: def.id });
  }
  return isModuleActive({ guildId, moduleId: command.module });
}

/** "Sistem kapali" kartinda gosterilecek etiket. */
export function commandGateLabel(command) {
  if (command?.system) {
    const def = systems.get(command.system);
    if (def) return def.name;
  }
  const moduleDef = getModule(command?.module);
  return moduleDef?.name ?? command?.module ?? '';
}
