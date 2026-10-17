/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../../db/index.js';
import { getRedis, isRedisReady } from '../../../core/redis.js';

// ---------------------------------------------------------------------------
// Modul katalogu (12.3 tablosu)
// ---------------------------------------------------------------------------

export const GUARD_MODULES = Object.freeze([
  { key: 'rol', name: 'Rol Koruması', emojiKey: 'ROL', logKey: 'log_rol_sil', defaultPunish: 'rolleri-al', defaultLimit: 1, defaultWindow: 10 },
  { key: 'kanal', name: 'Kanal & Kategori Koruması', emojiKey: 'KANAL', logKey: 'log_kanal_sil', defaultPunish: 'rolleri-al', defaultLimit: 1, defaultWindow: 10 },
  { key: 'webhook', name: 'Webhook Koruması', emojiKey: 'LINK', logKey: 'log_webhook', defaultPunish: 'rolleri-al', defaultLimit: 1, defaultWindow: 10 },
  { key: 'bot', name: 'Bot Ekleme Koruması', emojiKey: 'KALKAN', logKey: 'log_guard', defaultPunish: 'rolleri-al', defaultLimit: 1, defaultWindow: 30 },
  { key: 'sunucu', name: 'Sunucu Ayarları Koruması', emojiKey: 'AYAR', logKey: 'log_guild_update', defaultPunish: 'rolleri-al', defaultLimit: 1, defaultWindow: 10 },
  { key: 'url', name: 'URL (Vanity) Koruması', emojiKey: 'LINK', logKey: 'log_guard', defaultPunish: 'ban', defaultLimit: 1, defaultWindow: 60 },
  { key: 'ban_kick', name: 'Ban/Kick Koruması', emojiKey: 'BAN', logKey: 'log_ban', defaultPunish: 'rolleri-al', defaultLimit: 4, defaultWindow: 60 },
  { key: 'emoji', name: 'Emoji/Sticker Koruması', emojiKey: 'YILDIZ', logKey: 'log_emoji', defaultPunish: 'rolleri-al', defaultLimit: 3, defaultWindow: 30 },
  { key: 'rol_perm', name: 'Rol-Perm Koruması', emojiKey: 'ROL', logKey: 'log_rol_guncelle', defaultPunish: 'rolleri-al', defaultLimit: 1, defaultWindow: 10 },
  { key: 'guvenli_rol', name: 'Güvenli Rol (@everyone) Koruması', emojiKey: 'KILIT', logKey: 'log_izin', defaultPunish: 'ban', defaultLimit: 1, defaultWindow: 10 },
  { key: 'yetkili_rol', name: 'Yetkili Rol Verme Koruması', emojiKey: 'ROL_VER', logKey: 'log_rol_ver_al', defaultPunish: 'rolleri-al', defaultLimit: 1, defaultWindow: 10 },
  { key: 'davet_giris', name: 'Davet/Giriş (Raid) Koruması', emojiKey: 'RAID', logKey: 'log_giris_cikis', defaultPunish: 'rolleri-al', defaultLimit: 10, defaultWindow: 10 },
  { key: 'mention', name: 'Mention Koruması', emojiKey: 'DUYURU', logKey: 'log_guard', defaultPunish: 'uyar', defaultLimit: 3, defaultWindow: 30 },
  { key: 'icerik', name: 'Reklam/Spam/Küfür/Link Koruması', emojiKey: 'SIL', logKey: 'log_mesaj_silme', defaultPunish: 'uyar', defaultLimit: 5, defaultWindow: 30 },
  { key: 'mesaj_koruma', name: 'Mesaj Silme Koruması (loglar)', emojiKey: 'GUARD', logKey: 'log_guard', defaultPunish: 'rolleri-al', defaultLimit: 1, defaultWindow: 10 },
]);

export const PUNISH_TYPES = Object.freeze(['ban', 'kick', 'rolleri-al', 'sadece-geri-al', 'uyar']);
export const PUNISH_LABELS = Object.freeze({
  ban: 'Ban',
  kick: 'Kick',
  'rolleri-al': 'Rolleri Al',
  'sadece-geri-al': 'Sadece Geri Al',
  uyar: 'Uyarı',
});

/**
 * Guvenli kademe -> muaf oldugu moduller (12.2).
 * Kademe 4: tum guard muaf. Kademe 3: rol/kanal islemleri serbest.
 */
export const TIER_COVERAGE = Object.freeze({
  1: ['icerik'],
  2: ['icerik', 'mention', 'emoji', 'mesaj_koruma'],
  3: [
    'icerik', 'mention', 'emoji', 'mesaj_koruma',
    'rol', 'kanal', 'rol_perm', 'webhook', 'sunucu',
  ],
  4: '*',
});

export const DEFAULT_NIGHT_PERMS = Object.freeze([
  'Administrator',
  'ManageRoles',
  'ManageChannels',
  'ManageGuild',
  'BanMembers',
  'KickMembers',
  'ManageWebhooks',
  'ManageMessages',
  'ManageEmojisAndStickers',
  'MentionEveryone',
]);

/** Kademe bu modulden muaf mi? (Bilinmeyen/aralik disi kademe: muaf degil.) */
export function tierCovers(tier, moduleKey) {
  const coverage = TIER_COVERAGE[Number(tier)];
  if (!coverage) return false;
  if (coverage === '*') return true;
  return coverage.includes(moduleKey);
}

export function moduleDef(moduleKey) {
  return GUARD_MODULES.find((m) => m.key === moduleKey) ?? null;
}

function defaultModuleSettings(def) {
  return {
    enabled: true,
    punish: def.defaultPunish,
    limit: def.defaultLimit,
    window: def.defaultWindow,
  };
}

export function defaultGuardConfig() {
  const modules = {};
  for (const def of GUARD_MODULES) modules[def.key] = defaultModuleSettings(def);
  return {
    modules,
    chatSafe: { channels: [], roles: [], badWords: [], blockAllLinks: false },
    nightExemptRoles: [],
  };
}

// ---------------------------------------------------------------------------
// Okuma / yazma (onbellekli)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000;
const processCache = new Map(); // guildId -> {at, config}

function mergeConfig(doc) {
  const base = defaultGuardConfig();
  if (!doc) return base;
  for (const def of GUARD_MODULES) {
    const stored = doc.modules?.[def.key];
    if (stored && typeof stored === 'object') {
      base.modules[def.key] = { ...base.modules[def.key], ...stored };
    }
  }
  if (doc.chat_safe && typeof doc.chat_safe === 'object') {
    base.chatSafe = { ...base.chatSafe, ...doc.chat_safe };
  }
  if (Array.isArray(doc.night_exempt_roles)) base.nightExemptRoles = doc.night_exempt_roles;
  return base;
}

/** Sunucu guard ayarlari (60 sn onbellek). */
export async function getGuardConfig(guildId, { fresh = false } = {}) {
  if (!guildId) return defaultGuardConfig();

  const cached = processCache.get(guildId);
  if (!fresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.config;

  let doc = null;
  if (isDbReady()) {
    try {
      doc = await getCollection('guard_config').findOne({ guild_id: guildId });
    } catch {
      /* varsayilan */
    }
  }
  const config = mergeConfig(doc);
  processCache.set(guildId, { at: Date.now(), config });
  return config;
}

export function invalidateGuardConfig(guildId) {
  if (guildId) processCache.delete(guildId);
  else processCache.clear();
}

/** Modul ayari gunceller (12.6 /guard-ayar). */
export async function setGuardModuleSetting(guildId, moduleKey, patch = {}) {
  if (!moduleDef(moduleKey)) return { ok: false, error: 'modul_yok' };
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };

  const update = {};
  for (const field of ['enabled', 'punish', 'limit', 'window']) {
    if (patch[field] !== undefined) update[`modules.${moduleKey}.${field}`] = patch[field];
  }
  if (Object.keys(update).length === 0) return { ok: false, error: 'degisiklik_yok' };

  const now = new Date().toISOString();
  try {
    await getCollection('guard_config').updateOne(
      { guild_id: guildId },
      { $set: { ...update, updated_at: now }, $setOnInsert: { created_at: now } },
      { upsert: true },
    );
  } catch {
    return { ok: false, error: 'db_hata' };
  }
  invalidateGuardConfig(guildId);
  return { ok: true };
}

/** Sohbet guvenligi ayarlari (chat-safe kanal/rol, kotu kelimeler, tum linkler). */
export async function setGuardChatSafe(guildId, patch = {}) {
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };
  const update = {};
  for (const field of ['channels', 'roles', 'badWords', 'blockAllLinks']) {
    if (patch[field] !== undefined) update[`chat_safe.${field}`] = patch[field];
  }
  if (Object.keys(update).length === 0) return { ok: false, error: 'degisiklik_yok' };
  const now = new Date().toISOString();
  try {
    await getCollection('guard_config').updateOne(
      { guild_id: guildId },
      { $set: { ...update, updated_at: now }, $setOnInsert: { created_at: now } },
      { upsert: true },
    );
  } catch {
    return { ok: false, error: 'db_hata' };
  }
  invalidateGuardConfig(guildId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Guvenli liste (12.2)
// ---------------------------------------------------------------------------

export async function getSafeList(guildId) {
  if (!isDbReady()) return [];
  try {
    return await getCollection('guard_safe').find({ guild_id: guildId }).sort({ added_at: 1 }).toArray();
  } catch {
    return [];
  }
}

export async function addSafeEntry({ guildId, userId, tier = 4, addedBy = null, label = null }) {
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };
  const safeTier = Math.min(Math.max(Number(tier) || 4, 1), 4);
  const now = new Date().toISOString();
  await getCollection('guard_safe').updateOne(
    { guild_id: guildId, user_id: userId },
    { $set: { tier: safeTier, added_by: addedBy, label, updated_at: now }, $setOnInsert: { created_at: now, added_at: now } },
    { upsert: true },
  );
  return { ok: true, tier: safeTier };
}

export async function removeSafeEntry(guildId, userId) {
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };
  const result = await getCollection('guard_safe').deleteOne({ guild_id: guildId, user_id: userId });
  return { ok: true, removed: result.deletedCount > 0 };
}

/**
 * Aktor guvenli mi? Sunucu sahibi, botun kendisi ve bot sahibi her zaman muaftir.
 * @returns {Promise<{safe: boolean, tier: number|null, reason: string|null}>}
 */
export async function isSafeActor({ guildId, actorId, moduleKey, guildOwnerId = null, clientUserId = null, botOwnerIds = [] }) {
  if (!actorId) return { safe: false, tier: null, reason: null };
  if (guildOwnerId && actorId === guildOwnerId) return { safe: true, tier: 4, reason: 'sunucu_sahibi' };
  if (clientUserId && actorId === clientUserId) return { safe: true, tier: 4, reason: 'bot' };
  if (Array.isArray(botOwnerIds) && botOwnerIds.includes(actorId)) return { safe: true, tier: 4, reason: 'bot_sahibi' };

  if (!isDbReady()) return { safe: false, tier: null, reason: null };
  try {
    const doc = await getCollection('guard_safe').findOne({ guild_id: guildId, user_id: actorId });
    if (!doc) return { safe: false, tier: null, reason: null };
    const tier = Number(doc.tier) || 4;
    return { safe: tierCovers(tier, moduleKey), tier, reason: 'guvenli_liste' };
  } catch {
    return { safe: false, tier: null, reason: null };
  }
}

// ---------------------------------------------------------------------------
// Korumali roller
// ---------------------------------------------------------------------------

export async function getProtectedRoles(guildId) {
  if (!isDbReady()) return [];
  try {
    return await getCollection('guard_protected_roles').find({ guild_id: guildId }).sort({ added_at: 1 }).toArray();
  } catch {
    return [];
  }
}

export async function addProtectedRole({ guildId, roleId, addedBy = null }) {
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };
  const now = new Date().toISOString();
  await getCollection('guard_protected_roles').updateOne(
    { guild_id: guildId, role_id: roleId },
    { $set: { added_by: addedBy, updated_at: now }, $setOnInsert: { created_at: now, added_at: now } },
    { upsert: true },
  );
  return { ok: true };
}

export async function removeProtectedRole(guildId, roleId) {
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };
  const result = await getCollection('guard_protected_roles').deleteOne({ guild_id: guildId, role_id: roleId });
  return { ok: true, removed: result.deletedCount > 0 };
}

// ---------------------------------------------------------------------------
// Link beyaz listesi (12.2)
// ---------------------------------------------------------------------------

export async function getLinkWhitelist(guildId) {
  if (!isDbReady()) return [];
  try {
    return await getCollection('guard_link_whitelist').find({ guild_id: guildId }).sort({ added_at: 1 }).toArray();
  } catch {
    return [];
  }
}

export function normalizeDomain(input) {
  const raw = String(input ?? '').trim().toLowerCase();
  if (!raw) return null;
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export async function addLinkWhitelist({ guildId, domain, addedBy = null }) {
  const normalized = normalizeDomain(domain);
  if (!normalized) return { ok: false, error: 'alan_gecersiz' };
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };
  const now = new Date().toISOString();
  await getCollection('guard_link_whitelist').updateOne(
    { guild_id: guildId, domain: normalized },
    { $set: { added_by: addedBy, updated_at: now }, $setOnInsert: { created_at: now, added_at: now } },
    { upsert: true },
  );
  return { ok: true, domain: normalized };
}

export async function removeLinkWhitelist(guildId, domain) {
  const normalized = normalizeDomain(domain);
  if (!normalized) return { ok: false, error: 'alan_gecersiz' };
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };
  const result = await getCollection('guard_link_whitelist').deleteOne({ guild_id: guildId, domain: normalized });
  return { ok: true, removed: result.deletedCount > 0 };
}
