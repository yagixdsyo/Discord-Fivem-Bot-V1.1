/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getGuildConfig, setGuildSetting } from '../../../core/guildSettings.js';

export const LOGS_DISABLED_KEY = 'logs.disabled';

function disabledList(config) {
  const value = config?.settings?.[LOGS_DISABLED_KEY];
  return Array.isArray(value) ? value.map(String) : [];
}

/** Kanal bazli log acik mi? (varsayilan: acik) */
export async function isLogChannelEnabled(guildId, key) {
  if (!guildId || !key) return false;
  try {
    const config = await getGuildConfig(guildId);
    return !disabledList(config).includes(key);
  } catch {
    return true;
  }
}

/** Kanal bazli log ac/kapat. @returns {Promise<boolean>} yazildi mi */
export async function setLogChannelEnabled(guildId, key, enabled) {
  if (!guildId || !key) return false;
  const config = await getGuildConfig(guildId, { fresh: true });
  const set = new Set(disabledList(config));
  if (enabled) set.delete(key);
  else set.add(key);
  return setGuildSetting(guildId, LOGS_DISABLED_KEY, [...set]);
}
