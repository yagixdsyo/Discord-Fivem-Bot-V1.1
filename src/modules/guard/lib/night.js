/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../../db/index.js';
import { getLogger } from '../../../core/logger.js';
import { isSystemActive } from '../../../core/systemRegistry.js';
import { emitLog } from '../../logging/lib/emit.js';
import { sendOwnerLog } from '../../../owner/lib/ownerLog.js';
import { DEFAULT_NIGHT_PERMS, getGuardConfig } from './config.js';
import { dangerousPermMask, hasDangerousPerms } from './punish.js';
import { PermissionFlagsBits } from 'discord.js';
import { warn as warnTemplate } from '../../../ui/templates/index.js';

const CACHE_TTL_MS = 5 * 60 * 1000;
const processCache = new Map(); // guildId -> {at, doc}

export function defaultNightDoc() {
  return {
    enabled: false,
    start: '00:00',
    end: '07:00',
    timezone: 'Europe/Istanbul',
    perms: [...DEFAULT_NIGHT_PERMS],
    safe_tier_exempt: false,
    sleeping: false,
    snapshot: [],
    slept_at: null,
    waked_at: null,
  };
}

/** 'HH:MM' -> gun ici saniye; gecersizse null. */
export function parseTime(input) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(input ?? '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 3600 + minutes * 60;
}

/** Pencere icinde mi? Gece yarisini asan araliklari destekler (22:00-06:00). */
export function withinWindow(nowSec, startSec, endSec) {
  if (startSec === null || endSec === null || startSec === endSec) return false;
  if (startSec < endSec) return nowSec >= startSec && nowSec < endSec;
  return nowSec >= startSec || nowSec < endSec;
}

/** Saat diliminde su anki gun-ici saniye. */
export function nowSecondsInTz(timezone = 'Europe/Istanbul', date = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const hours = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const minutes = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return hours * 3600 + minutes * 60;
  } catch {
    return date.getUTCHours() * 3600 + date.getUTCMinutes() * 60;
  }
}

/** Izın adlarini maskeye cevirir. */
export function nightPermsMask(permNames = DEFAULT_NIGHT_PERMS) {
  let mask = 0n;
  for (const name of permNames) {
    const bit = PermissionFlagsBits[name];
    if (bit !== undefined) mask |= BigInt(bit);
  }
  return mask;
}

export async function getNightDoc(guildId, { fresh = false } = {}) {
  if (!guildId) return defaultNightDoc();
  const cached = processCache.get(guildId);
  if (!fresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.doc;

  let stored = null;
  if (isDbReady()) {
    try {
      stored = await getCollection('guard_night_mode').findOne({ guild_id: guildId });
    } catch {
      /* varsayilan */
    }
  }
  const doc = { ...defaultNightDoc(), ...(stored ?? {}) };
  if (!Array.isArray(doc.perms) || doc.perms.length === 0) doc.perms = [...DEFAULT_NIGHT_PERMS];
  if (!Array.isArray(doc.snapshot)) doc.snapshot = [];
  processCache.set(guildId, { at: Date.now(), doc });
  return doc;
}

export function invalidateNightDoc(guildId) {
  if (guildId) processCache.delete(guildId);
  else processCache.clear();
}

export async function setNightDoc(guildId, patch = {}) {
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };
  const now = new Date().toISOString();
  const set = { updated_at: now };
  for (const field of ['enabled', 'start', 'end', 'timezone', 'perms', 'safe_tier_exempt', 'sleeping', 'snapshot', 'slept_at', 'waked_at']) {
    if (patch[field] !== undefined) set[field] = patch[field];
  }
  await getCollection('guard_night_mode').updateOne(
    { guild_id: guildId },
    { $set: set, $setOnInsert: { created_at: now, guild_id: guildId } },
    { upsert: true },
  );
  invalidateNightDoc(guildId);
  return { ok: true };
}

async function emitNightLog(guild, lines, accent = 'info') {
  await emitLog(guild, 'log_gece_modu', {
    lines,
    accent,
  });
}

/**
 * Uykuya gec: tehlikeli izinleri al, snapshot sakla, uyari logla.
 * @returns {Promise<{action: 'sleep', stripped: number, failed: number}>}
 */
export async function applySleep(client, guild, doc) {
  const guardConfig = await getGuardConfig(guild.id);
  const exemptRoles = new Set(guardConfig.nightExemptRoles ?? []);
  const permMask = nightPermsMask(doc.perms);
  const snapshot = [];
  let stripped = 0;
  let failed = 0;

  for (const role of guild.roles.cache.values()) {
    if (role.managed) continue;
    if (exemptRoles.has(role.id)) continue;
    if (!hasDangerousPerms(role.permissions.bitfield)) continue;
    if ((BigInt(role.permissions.bitfield) & permMask) === 0n) continue;
    if (!role.editable) {
      failed += 1;
      continue;
    }

    snapshot.push({ role_id: role.id, name: role.name, permissions: String(role.permissions.bitfield) });
    try {
      await role.setPermissions(BigInt(role.permissions.bitfield) & ~permMask, 'Gece modu: tehlikeli izinler geçici alındı');
      stripped += 1;
    } catch {
      failed += 1;
    }
  }

  await setNightDoc(guild.id, {
    sleeping: true,
    snapshot,
    slept_at: new Date().toISOString(),
  });

  await emitNightLog(guild, [
    `Gece modu **başladı** (${doc.start} - ${doc.end}, ${doc.timezone}).`,
    `İzni alınan rol: **${stripped}**`,
    failed > 0 ? `Uygulanamayan rol: **${failed}** — manuel kontrol gerekebilir.` : null,
  ].filter(Boolean), failed > 0 ? 'warn' : 'info');

  getLogger().info({ guildId: guild.id, stripped, failed }, 'Gece modu uykuya geçti');
  return { action: 'sleep', stripped, failed };
}

/**
 * Uyandir: snapshot'tan izinleri geri yukle (1 kez yeniden dener).
 * @returns {Promise<{action: 'wake', restored: number, failures: Array}>}
 */
export async function applyWake(client, guild, doc, config = null) {
  let failures = [];
  let restored = 0;
  const snapshot = Array.isArray(doc.snapshot) ? doc.snapshot : [];

  const applySnapshot = async (snap) => {
    const role = guild.roles.cache.get(snap.role_id);
    if (!role) return { role_id: snap.role_id, name: snap.name, reason: 'rol_yok' };
    try {
      await role.setPermissions(BigInt(snap.permissions), 'Gece modu bitti: izinler geri yüklendi');
      return null;
    } catch (err) {
      return { role_id: snap.role_id, name: snap.name, reason: err?.message ?? 'hata' };
    }
  };

  for (const snap of snapshot) {
    const failure = await applySnapshot(snap);
    if (failure) failures.push(failure);
    else restored += 1;
  }

  // Basarisizlar icin tek yeniden deneme (12.5)
  if (failures.length > 0) {
    const retryFailures = [];
    for (const failure of failures) {
      const snap = snapshot.find((s) => s.role_id === failure.role_id);
      if (!snap) {
        retryFailures.push(failure);
        continue;
      }
      const retry = await applySnapshot(snap);
      if (retry) retryFailures.push(retry);
      else restored += 1;
    }
    failures = retryFailures;
  }

  await setNightDoc(guild.id, { sleeping: false, snapshot: [], waked_at: new Date().toISOString() });

  await emitNightLog(guild, [
    `Gece modu **bitti** — izinler geri yüklendi.`,
    `Geri yüklenen rol: **${restored}**`,
    failures.length > 0 ? `Geri yüklenemeyen rol: **${failures.length}** — ${failures.map((f) => f.name ?? f.role_id).join(', ')}` : null,
  ].filter(Boolean), failures.length > 0 ? 'error' : 'info');

  if (failures.length > 0 && config) {
    await sendOwnerLog(
      warnTemplate('Gece modu', [
        `Gece modu kapatılırken **${failures.length}** rol geri yüklenemedi.`,
        `Sunucu: **${guild.name}** (\`${guild.id}\`)`,
        `Roller: ${failures.map((f) => f.name ?? f.role_id).join(', ')}`,
      ]),
      config,
    ).catch(() => {});
  }

  getLogger().info({ guildId: guild.id, restored, failures: failures.length }, 'Gece modu uyandı');
  return { action: 'wake', restored, failures };
}

/**
 * Scheduler tek turu: uyku/uyanma karari verir (60 sn'de bir cagrilir).
 * @returns {Promise<{action: 'sleep'|'wake'|'none', reason?: string}>}
 */
export async function runNightTick(client, guildId, config = null) {
  const guild = client?.guilds?.cache?.get(guildId);
  if (!guild) return { action: 'none', reason: 'sunucu_yok' };

  const doc = await getNightDoc(guildId);
  const startSec = parseTime(doc.start);
  const endSec = parseTime(doc.end);
  const inWindow = withinWindow(nowSecondsInTz(doc.timezone), startSec, endSec);
  // Guard sistemi kapaliysa YENI uyku baslatilmaz; uykudakiler yine uyandirilir.
  const guardActive = await isSystemActive({ guildId, systemId: 'guard' });
  const shouldSleep = Boolean(doc.enabled) && inWindow && guardActive;

  try {
    if (shouldSleep && !doc.sleeping) return await applySleep(client, guild, doc);
    if (!shouldSleep && doc.sleeping) return await applyWake(client, guild, doc, config);
  } catch (err) {
    getLogger().warn({ guildId, err: err?.message }, 'Gece modu turu hatası');
    return { action: 'none', reason: 'hata' };
  }
  return { action: 'none' };
}

/** Acilista: uyku durumunda kalan sunuculari pencerenin disindaysa uyandirir. */
export async function startupNightCheck(client, config = null) {
  if (!isDbReady()) return 0;
  let sleepingDocs = [];
  try {
    sleepingDocs = await getCollection('guard_night_mode').find({ sleeping: true }).toArray();
  } catch {
    return 0;
  }
  let woken = 0;
  for (const doc of sleepingDocs) {
    invalidateNightDoc(doc.guild_id);
    const result = await runNightTick(client, doc.guild_id, config);
    if (result?.action === 'wake') woken += 1;
  }
  return woken;
}
