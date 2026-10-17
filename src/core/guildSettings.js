/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../db/index.js';
import { getJSON, isRedisReady, setJSON } from './redis.js';

const CACHE_TTL_SECONDS = 60;

let defaultPrefix = '.';

export function setDefaultPrefix(prefix) {
  if (prefix) defaultPrefix = prefix;
}

export function getDefaultPrefix() {
  return defaultPrefix;
}

function defaultConfig() {
  return {
    prefix: defaultPrefix,
    language: 'tr',
    setupDone: false,
    botType: 'fivem',
    settings: {},
  };
}

/**
 * Sunucu ayarini doner: {prefix, language, setupDone, botType, settings:{...}}
 * @param {string} guildId
 * @param {{ fresh?: boolean }} [opts] fresh: onbellegi atla
 */
export async function getGuildConfig(guildId, { fresh = false } = {}) {
  if (!guildId) return defaultConfig();

  const cacheKey = `cfg:guild:${guildId}`;
  if (!fresh && isRedisReady()) {
    const hit = await getJSON(cacheKey);
    if (hit) return hit;
  }

  if (!isDbReady()) return defaultConfig();

  try {
    const [guildDoc, settingsDocs] = await Promise.all([
      getCollection('guilds').findOne({ guild_id: guildId }),
      getCollection('guild_settings').find({ guild_id: guildId }).toArray(),
    ]);

    const settings = {};
    for (const doc of settingsDocs) settings[doc.key] = doc.value;

    const config = {
      prefix: guildDoc?.prefix ?? defaultPrefix,
      language: guildDoc?.language ?? 'tr',
      setupDone: Boolean(guildDoc?.setup_done),
      botType: guildDoc?.bot_type ?? 'fivem',
      settings,
    };

    if (isRedisReady()) await setJSON(cacheKey, config, CACHE_TTL_SECONDS);
    return config;
  } catch {
    return defaultConfig();
  }
}

/** guilds kaydini olustur/guncelle (guildCreate veya ilk erisimde). */
export async function touchGuild(guild) {
  if (!isDbReady() || !guild?.id) return;
  const now = new Date().toISOString();
  await getCollection('guilds').updateOne(
    { guild_id: guild.id },
    {
      $set: {
        name: guild.name,
        owner_id: guild.ownerId ?? null,
        updated_at: now,
        left_at: null,
      },
      $setOnInsert: {
        prefix: defaultPrefix,
        language: 'tr',
        setup_done: false,
        bot_type: 'fivem',
        joined_at: now,
        created_at: now,
      },
    },
    { upsert: true },
  );
}

/** Tek ayar yaz (jsonb karsiligi: value). Onbellegi gecersiz kil. */
export async function setGuildSetting(guildId, key, value, { invalidate = true } = {}) {
  if (!isDbReady()) return false;
  const now = new Date().toISOString();
  await getCollection('guild_settings').updateOne(
    { guild_id: guildId, key },
    { $set: { value, updated_at: now }, $setOnInsert: { created_at: now } },
    { upsert: true },
  );
  if (invalidate && isRedisReady()) await getJSON(`cfg:guild:${guildId}`).then(() => invalidateGuildConfig(guildId));
  return true;
}

/** Sunucu ayar onbellegini temizler. */
export async function invalidateGuildConfig(guildId) {
  if (!isRedisReady()) return;
  const { delKey } = await import('./redis.js');
  await delKey(`cfg:guild:${guildId}`);
}
