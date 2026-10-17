/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getGuildConfig, setGuildSetting } from './guildSettings.js';

export const SETTINGS_KEY = 'rank_levels';
export const MAX_LEVEL = 100;

/**
 * { [roleId]: seviye } eslemesini okur (yoksa {}).
 * @param {string} guildId
 * @returns {Promise<Record<string, number>>}
 */
export async function getRankLevels(guildId) {
  if (!guildId) return {};
  const cfg = await getGuildConfig(guildId).catch(() => null);
  const raw = cfg?.settings?.[SETTINGS_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean = {};
  for (const [roleId, level] of Object.entries(raw)) {
    const n = Math.floor(Number(level));
    if (/^\d{5,}$/.test(roleId) && Number.isFinite(n) && n >= 1 && n <= MAX_LEVEL) {
      clean[roleId] = n;
    }
  }
  return clean;
}

/**
 * Rol seviyesini kaydeder.
 * @returns {Promise<{ok: boolean, levels: Record<string, number>}>}
 */
export async function setRankLevel(guildId, roleId, level) {
  const levels = await getRankLevels(guildId);
  levels[roleId] = Math.floor(Number(level));
  const ok = await setGuildSetting(guildId, SETTINGS_KEY, levels);
  return { ok: ok !== false, levels };
}

/**
 * Rol seviyesini kaldirir.
 * @returns {Promise<{ok: boolean, levels?: Record<string, number>, reason?: 'yok'}>}
 */
export async function removeRankLevel(guildId, roleId) {
  const levels = await getRankLevels(guildId);
  if (!(roleId in levels)) return { ok: false, reason: 'yok' };
  delete levels[roleId];
  const ok = await setGuildSetting(guildId, SETTINGS_KEY, levels);
  return { ok: ok !== false, levels };
}

/**
 * Uyesin en yuksek rutbe seviyesi (saf fonksiyon - test edilebilir).
 * @param {object|null} member
 * @param {Record<string, number>|null} rankLevels
 * @returns {number}
 */
export function memberRankLevel(member, rankLevels) {
  if (!member || !rankLevels) return 0;
  const roleIds = member.roles?.cache?.keys?.();
  if (!roleIds) return 0;
  let max = 0;
  for (const roleId of roleIds) {
    const level = Number(rankLevels[roleId]);
    if (Number.isFinite(level) && level > max) max = level;
  }
  return max;
}
