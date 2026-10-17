/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getGuildConfig, setGuildSetting } from '../../../core/guildSettings.js';
import { getLatestBackup } from './store.js';
import { createBackup } from './create.js';

export const AUTO_CHECK_MS = 15 * 60_000;
export const AUTO_INTERVAL_HOURS = 12;
export const AUTO_INTERVAL_OPTIONS = Object.freeze([6, 12, 24]);
export const PRE_SNAPSHOT_MIN_GAP_MS = 10 * 60_000;

function docTime(doc) {
  return doc?.created_at ? new Date(doc.created_at).getTime() : 0;
}

/** Sunucunun otomatik backup araligi (guild_settings: backup.auto_hours, 6/12/24). */
export async function getAutoIntervalHours(guildId) {
  try {
    const config = await getGuildConfig(guildId);
    const hours = Number(config?.settings?.['backup.auto_hours']);
    if (AUTO_INTERVAL_OPTIONS.includes(hours)) return hours;
  } catch {
    /* varsayilan */
  }
  return AUTO_INTERVAL_HOURS;
}

/** Otomatik backup araligini ayarlar (6/12/24 disi reddedilir). */
export async function setAutoIntervalHours(guildId, hours) {
  const value = Number(hours);
  if (!AUTO_INTERVAL_OPTIONS.includes(value)) return { ok: false, error: 'gecersiz_aralik' };
  const ok = await setGuildSetting(guildId, 'backup.auto_hours', value);
  return ok ? { ok: true, value } : { ok: false, error: 'db_hazir_degil' };
}

/**
 * Suresi gelen sunucular icin otomatik backup alir.
 * @returns {Promise<number>} alinan backup sayisi
 */
export async function runAutoBackups(client, { intervalHours = null } = {}) {
  let count = 0;
  for (const guild of client?.guilds?.cache?.values() ?? []) {
    try {
      const hours = intervalHours ?? (await getAutoIntervalHours(guild.id));
      const latest = await getLatestBackup(guild.id, 'auto');
      const ageMs = Date.now() - docTime(latest);
      if (latest && ageMs < hours * 3600 * 1000) continue;
      await createBackup(guild, { kind: 'auto' });
      count += 1;
    } catch {
      /* tek sunucu hatasi akisi durdurmaz */
    }
  }
  return count;
}

/**
 * Saldiri oncesi hafif snapshot (guard ihlalinde tetiklenir).
 * @returns {Promise<boolean>} alindi mi
 */
export async function triggerPreSnapshot(guild, { minGapMs = PRE_SNAPSHOT_MIN_GAP_MS } = {}) {
  try {
    const latest = await getLatestBackup(guild.id, 'pre');
    if (latest && Date.now() - docTime(latest) < minGapMs) return false;
    await createBackup(guild, { kind: 'pre' });
    return true;
  } catch {
    return false;
  }
}
