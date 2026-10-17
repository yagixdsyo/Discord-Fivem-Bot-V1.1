/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../db/index.js';
import { deleteByPattern, isRedisReady } from '../../core/redis.js';
import {
  invalidateAllGuildGates,
  invalidateBlacklistCache,
  invalidateGlobalGate,
  invalidateGuildGate,
} from '../../core/ownerGate.js';
import { setModuleEnabled } from '../../core/moduleRegistry.js';

export const GLOBAL_SCOPE = 'global';

const dbMissing = { ok: false, error: 'db_hazir_degil' };

async function upsertMaintenance({ scope, target, guildId, enabled, reason = null, until = null, setBy = null, payload = null }) {
  if (!isDbReady()) return { ...dbMissing };
  const collection = getCollection('owner_maintenance');
  const now = new Date().toISOString();

  if (enabled) {
    await collection.updateOne(
      { scope, target, guild_id: guildId },
      {
        $set: {
          enabled: true,
          reason: reason ?? null,
          until: until ?? null,
          payload: payload ?? null,
          set_by: setBy,
          updated_at: now,
        },
        $setOnInsert: { created_at: now },
      },
      { upsert: true },
    );
  } else {
    await collection.deleteMany({ scope, target, guild_id: guildId });
  }
  return { ok: true };
}

async function invalidateCommandScopes(scope) {
  if (scope === GLOBAL_SCOPE) await invalidateAllGuildGates();
  else await invalidateGuildGate(scope);
}

// ---------------------------------------------------------------------------
// Global durdurma / bakim
// ---------------------------------------------------------------------------

export async function setGlobalPause({ enabled, reason = null, until = null, setBy = null, guard = false }) {
  const result = await upsertMaintenance({
    scope: 'global',
    target: 'pause',
    guildId: GLOBAL_SCOPE,
    enabled,
    reason,
    until,
    setBy,
    payload: { guard: Boolean(guard) },
  });
  await invalidateGlobalGate();
  return result;
}

export async function setGlobalMaintenance({ enabled, reason = null, until = null, setBy = null }) {
  const result = await upsertMaintenance({
    scope: 'global',
    target: 'maintenance',
    guildId: GLOBAL_SCOPE,
    enabled,
    reason,
    until,
    setBy,
  });
  await invalidateGlobalGate();
  return result;
}

// ---------------------------------------------------------------------------
// Sunucu deaktif + kara liste
// ---------------------------------------------------------------------------

export async function setGuildDeactivated({ guildId, enabled, reason = null, setBy = null }) {
  const result = await upsertMaintenance({ scope: 'guild', target: guildId, guildId, enabled, reason, setBy });
  await invalidateGuildGate(guildId);
  return result;
}

export async function addBlacklist({ guildId, reason = null, addedBy = null, notify = true }) {
  if (!isDbReady()) return { ...dbMissing };
  await getCollection('owner_blacklist').updateOne(
    { guild_id: guildId },
    {
      $set: {
        reason: reason ?? null,
        added_by: addedBy,
        notify: Boolean(notify),
        added_at: new Date().toISOString(),
      },
    },
    { upsert: true },
  );
  await invalidateBlacklistCache();
  await invalidateGuildGate(guildId);
  return { ok: true };
}

export async function removeBlacklist(guildId) {
  if (!isDbReady()) return { ...dbMissing };
  const result = await getCollection('owner_blacklist').deleteOne({ guild_id: guildId });
  await invalidateBlacklistCache();
  await invalidateGuildGate(guildId);
  return { ok: result.deletedCount > 0 };
}

export async function listBlacklistEntries() {
  if (!isDbReady()) return [];
  try {
    return await getCollection('owner_blacklist').find({}).sort({ added_at: -1 }).toArray();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Komut kapatma / bakim
// ---------------------------------------------------------------------------

/**
 * @param {{command: string, scope?: string, enabled: boolean, reason?: string|null, setBy?: string|null}} opts
 * enabled=false -> komutu kapatir; enabled=true -> kisitlari temizler.
 */
export async function setCommandDisabled({ command, scope = GLOBAL_SCOPE, enabled, reason = null, setBy = null }) {
  if (!isDbReady()) return { ...dbMissing };
  const collection = getCollection('guild_command_overrides');

  if (enabled === false) {
    await collection.updateOne(
      { guild_id: scope, command },
      {
        $set: { enabled: false, reason: reason ?? null, set_by: setBy, updated_at: new Date().toISOString() },
        $setOnInsert: { created_at: new Date().toISOString() },
      },
      { upsert: true },
    );
  } else {
    await collection.deleteMany({ guild_id: scope, command });
    await getCollection('owner_maintenance').deleteMany({ scope: 'command', target: command, guild_id: scope });
  }

  await invalidateCommandScopes(scope);
  return { ok: true };
}

export async function setCommandMaintenance({ command, scope = GLOBAL_SCOPE, enabled, until = null, reason = null, setBy = null }) {
  const result = await upsertMaintenance({
    scope: 'command',
    target: command,
    guildId: scope,
    enabled,
    reason,
    until,
    setBy,
  });
  await invalidateCommandScopes(scope);
  return result;
}

export async function setModuleMaintenance({ moduleId, scope = GLOBAL_SCOPE, enabled, until = null, reason = null, setBy = null }) {
  const result = await upsertMaintenance({
    scope: 'module',
    target: moduleId,
    guildId: scope,
    enabled,
    reason,
    until,
    setBy,
  });
  await invalidateCommandScopes(scope);
  return result;
}

/** Modul ac/kapat (global kapsamda tum modul onbellegi temizlenir). */
export async function setModuleEnabledScoped({ moduleId, scope = GLOBAL_SCOPE, enabled, by = null, reason = null }) {
  const target = scope === GLOBAL_SCOPE ? GLOBAL_SCOPE : scope;
  const result = await setModuleEnabled({ guildId: target, moduleId, enabled, by, reason });
  if (result.ok && scope === GLOBAL_SCOPE && isRedisReady()) {
    await deleteByPattern('mod:*');
  }
  return result;
}

// ---------------------------------------------------------------------------
// Durum sorgulari (rapor komutlari)
// ---------------------------------------------------------------------------

export async function listMaintenanceEntries() {
  const empty = { global: [], commands: [], modules: [] };
  if (!isDbReady()) return empty;
  try {
    const docs = await getCollection('owner_maintenance').find({ enabled: true }).toArray();
    return {
      global: docs.filter((d) => d.scope === 'global'),
      commands: docs.filter((d) => d.scope === 'command'),
      modules: docs.filter((d) => d.scope === 'module'),
    };
  } catch {
    return empty;
  }
}

export async function listDisabledCommands() {
  if (!isDbReady()) return [];
  try {
    return await getCollection('guild_command_overrides').find({ enabled: false }).toArray();
  } catch {
    return [];
  }
}
