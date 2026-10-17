/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../db/index.js';
import { delKey, getJSON, isRedisReady, setJSON } from './redis.js';

export const GATE_CODES = Object.freeze({
  BLACKLISTED: 'blacklisted',
  DEACTIVATED: 'deactivated',
  GLOBAL_PAUSED: 'global_paused',
  GLOBAL_MAINTENANCE: 'global_maintenance',
  COMMAND_DISABLED: 'command_disabled',
  COMMAND_MAINTENANCE: 'command_maintenance',
  MODULE_MAINTENANCE: 'module_maintenance',
});

const BLACKLIST_TTL = 120;
const STATE_TTL = 30;

// ---------------------------------------------------------------------------
// Saf karar fonksiyonu (birim testli)
// ---------------------------------------------------------------------------

/**
 * Kapi kararini verir (yan etkisiz).
 * @param {{
 *   guildId?: string|null,
 *   blacklistIds?: string[],
 *   guildState?: {deactivated?: object|null, disabledCommands?: string[], commandMaintenance?: object, moduleMaintenance?: object},
 *   globalState?: {pause?: object|null, maintenance?: object|null},
 *   isOwner?: boolean,
 *   commandName?: string|null,
 *   moduleId?: string|null,
 * }} opts
 * @returns {null | {code: string, until?: number|null, reason?: string|null, detail?: string|null}}
 */
export function decideGate({
  guildId = null,
  blacklistIds = [],
  guildState = null,
  globalState = null,
  isOwner = false,
  commandName = null,
  moduleId = null,
} = {}) {
  // DM (sunucu baglami yok): kapi uygulanmaz.
  if (!guildId) return null;

  // 1) Kara liste: hicbir sey yapilmaz (owner dahi)
  if (blacklistIds.includes(guildId)) {
    return { code: GATE_CODES.BLACKLISTED };
  }

  const gs = guildState ?? {};

  // 2) Sunucu deaktif (owner haric)
  if (gs.deactivated && !isOwner) {
    return { code: GATE_CODES.DEACTIVATED, reason: gs.deactivated.reason ?? null };
  }

  // 3) Global durdurma / bakim (owner haric)
  if (globalState?.pause && !isOwner) {
    return { code: GATE_CODES.GLOBAL_PAUSED, reason: globalState.pause.reason ?? null };
  }
  if (globalState?.maintenance && !isOwner) {
    return {
      code: GATE_CODES.GLOBAL_MAINTENANCE,
      until: globalState.maintenance.until ?? null,
      reason: globalState.maintenance.reason ?? null,
    };
  }

  if (isOwner) return null; // owner komut/modul kisitlarindan muaf

  // 4) Komut kapali / bakimda
  if (commandName) {
    if ((gs.disabledCommands ?? []).includes(commandName)) {
      return { code: GATE_CODES.COMMAND_DISABLED, detail: commandName };
    }
    const maint = (gs.commandMaintenance ?? {})[commandName];
    if (maint) {
      return { code: GATE_CODES.COMMAND_MAINTENANCE, until: maint.until ?? null, detail: commandName };
    }
  }

  // 5) Modul bakimda
  if (moduleId) {
    const maint = (gs.moduleMaintenance ?? {})[moduleId];
    if (maint) {
      return { code: GATE_CODES.MODULE_MAINTENANCE, until: maint.until ?? null, detail: moduleId };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Yukleyiciler (Redis onbellekli)
// ---------------------------------------------------------------------------

async function loadBlacklistGuildIds() {
  const cacheKey = 'gate:blacklist';
  if (isRedisReady()) {
    const cached = await getJSON(cacheKey);
    if (Array.isArray(cached)) return cached;
  }
  if (!isDbReady()) return [];
  try {
    const docs = await getCollection('owner_blacklist').find({}).project({ guild_id: 1 }).toArray();
    const ids = docs.map((d) => d.guild_id);
    if (isRedisReady()) await setJSON(cacheKey, ids, BLACKLIST_TTL);
    return ids;
  } catch {
    return [];
  }
}

function isActive(doc, now) {
  if (!doc || doc.enabled !== true) return false;
  if (doc.until && Number(doc.until) > 0 && Number(doc.until) < now) return false; // suresi gecmis
  return true;
}

async function loadGlobalState() {
  const cacheKey = 'gate:global';
  if (isRedisReady()) {
    const cached = await getJSON(cacheKey);
    if (cached) return cached;
  }
  if (!isDbReady()) return { pause: null, maintenance: null };

  try {
    const now = Date.now();
    const docs = await getCollection('owner_maintenance')
      .find({ scope: 'global' })
      .toArray();
    const state = {
      pause: docs.find((d) => d.target === 'pause' && isActive(d, now)) ?? null,
      maintenance: docs.find((d) => d.target === 'maintenance' && isActive(d, now)) ?? null,
    };
    if (isRedisReady()) await setJSON(cacheKey, state, STATE_TTL);
    return state;
  } catch {
    return { pause: null, maintenance: null };
  }
}

async function loadGuildState(guildId) {
  const cacheKey = `gate:g:${guildId}`;
  if (isRedisReady()) {
    const cached = await getJSON(cacheKey);
    if (cached) return cached;
  }
  const empty = { deactivated: null, disabledCommands: [], commandMaintenance: {}, moduleMaintenance: {} };
  if (!isDbReady()) return empty;

  try {
    const now = Date.now();
    const [deact, maintDocs, overrides] = await Promise.all([
      getCollection('owner_maintenance').findOne({ scope: 'guild', target: guildId, enabled: true }),
      getCollection('owner_maintenance')
        .find({
          enabled: true,
          scope: { $in: ['command', 'module'] },
          $or: [{ guild_id: guildId }, { guild_id: 'global' }, { guild_id: null }],
        })
        .toArray(),
      getCollection('guild_command_overrides')
        .find({ enabled: false, $or: [{ guild_id: guildId }, { guild_id: 'global' }] })
        .toArray(),
    ]);

    const state = {
      deactivated: isActive(deact, now) ? { reason: deact.reason ?? null } : null,
      disabledCommands: overrides.map((o) => o.command),
      commandMaintenance: {},
      moduleMaintenance: {},
    };

    for (const doc of maintDocs) {
      if (!isActive(doc, now)) continue;
      if (doc.scope === 'command') {
        state.commandMaintenance[doc.target] = { until: doc.until ?? null, reason: doc.reason ?? null };
      } else if (doc.scope === 'module') {
        state.moduleMaintenance[doc.target] = { until: doc.until ?? null, reason: doc.reason ?? null };
      }
    }

    if (isRedisReady()) await setJSON(cacheKey, state, STATE_TTL);
    return state;
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Kontrol
// ---------------------------------------------------------------------------

/**
 * @param {{guildId?: string|null, userId: string, commandName?: string, moduleId?: string, isOwner?: boolean}} opts
 * @returns {Promise<null | {code: string, until?: number|null, reason?: string|null, detail?: string|null}>}
 */
export async function checkOwnerGate({ guildId, userId, commandName, moduleId, isOwner = false }) {
  if (!guildId) return null; // DM: kapi yok

  const [blacklistIds, guildState, globalState] = await Promise.all([
    loadBlacklistGuildIds(),
    loadGuildState(guildId),
    loadGlobalState(),
  ]);

  return decideGate({
    guildId,
    blacklistIds,
    guildState,
    globalState,
    isOwner,
    commandName,
    moduleId,
  });
}

// ---------------------------------------------------------------------------
// Okuma yardimcilari (loader/komutlar icin)
// ---------------------------------------------------------------------------

/** Sunucu kara listede mi? (guildCreate otomatik ayrilma icin) */
export async function isGuildBlacklisted(guildId) {
  if (!guildId) return false;
  const ids = await loadBlacklistGuildIds();
  return ids.includes(guildId);
}

/** Kara liste kaydi (notify bayragi vb. icin). */
export async function getBlacklistEntry(guildId) {
  if (!guildId || !isDbReady()) return null;
  try {
    return await getCollection('owner_blacklist').findOne({ guild_id: guildId });
  } catch {
    return null;
  }
}

/** Global durdurma/bakim durumu (owner komutlari raporlar icin). */
export async function getGlobalGateState() {
  return loadGlobalState();
}

/** Sunucu kapi durumu (owner raporlari icin). */
export async function getGuildGateState(guildId) {
  return loadGuildState(guildId);
}

// ---------------------------------------------------------------------------
// Onbellek gecersiz kilma (owner komutlari kullanir)
// ---------------------------------------------------------------------------

export async function invalidateBlacklistCache() {
  if (isRedisReady()) await delKey('gate:blacklist');
}

export async function invalidateGlobalGate() {
  if (isRedisReady()) await delKey('gate:global');
}

export async function invalidateGuildGate(guildId) {
  if (isRedisReady()) await delKey(`gate:g:${guildId}`);
}

/** Global komut/modul degisikliklerinde tum sunucu kapi onbelleklerini temizler. */
export async function invalidateAllGuildGates() {
  if (!isRedisReady()) return 0;
  const { deleteByPattern } = await import('./redis.js');
  return deleteByPattern('gate:g:*');
}
