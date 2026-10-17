/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  CATEGORIES,
  CHANNELS,
  LOG_CHANNELS,
  MAX_CHANNELS_PER_CATEGORY,
  ROLES,
} from './catalog.js';

/** Secimi normalize et: Set | dizi | tekil id | undefined -> Set. */
export function makePackageSet(selection) {
  if (!selection) return new Set(['hepsi']);
  if (selection instanceof Set) return new Set(selection);
  if (Array.isArray(selection)) return selection.length > 0 ? new Set(selection) : new Set(['hepsi']);
  return new Set([String(selection)]);
}

/** Oge secili mi? Paketsiz ogeler (temel) her zaman dahildir. */
export function matchesPackage(spec, packages) {
  if (!spec?.package) return true;
  if (packages.has('hepsi')) return true;
  return packages.has(spec.package);
}

/**
 * Kurulum planini uretir.
 * @param {{packages?: Set<string>|string[]|string, options?: {cfxCode?: string, serverIp?: string, otoRolId?: string, yetkiliRolId?: string}}} opts
 */
export function buildSetupPlan({ packages, options = {} } = {}) {
  const pack = makePackageSet(packages);

  const roles = ROLES.filter((role) => matchesPackage(role, pack)).map((role) => ({ ...role }));

  const allChannels = [...CHANNELS, ...LOG_CHANNELS]
    .filter((channel) => matchesPackage(channel, pack))
    .map((channel) => ({ ...channel }));

  const byCategory = new Map();
  for (const channel of allChannels) {
    if (!byCategory.has(channel.category)) byCategory.set(channel.category, []);
    byCategory.get(channel.category).push(channel);
  }

  const categories = [];
  const channels = [];

  for (const catDef of CATEGORIES) {
    const list = byCategory.get(catDef.key) ?? [];
    if (list.length === 0) continue;

    for (let i = 0; i < list.length; i += MAX_CHANNELS_PER_CATEGORY) {
      const chunk = list.slice(i, i + MAX_CHANNELS_PER_CATEGORY);
      const index = Math.floor(i / MAX_CHANNELS_PER_CATEGORY);
      const spec =
        index === 0
          ? { ...catDef }
          : { ...catDef, key: `${catDef.key}_${index + 1}`, name: `${catDef.name} ${index + 1}` };
      categories.push(spec);
      for (const channel of chunk) channels.push({ ...channel, category: spec.key });
    }
  }

  const settings = { packages: [...pack] };
  if (options.cfxCode && String(options.cfxCode).trim()) settings.cfxCode = String(options.cfxCode).trim();
  if (options.serverIp && String(options.serverIp).trim()) settings.serverIp = String(options.serverIp).trim();
  if (options.otoRolId) settings.otoRolId = String(options.otoRolId);
  if (options.yetkiliRolId) settings.yetkiliRolId = String(options.yetkiliRolId);

  const stats = {
    roles: roles.length,
    categories: categories.length,
    channels: channels.length,
    logs: channels.filter((c) => c.key.startsWith('log_')).length,
    voices: channels.filter((c) => c.type === 'voice').length,
  };

  return { packages: [...pack], roles, categories, channels, settings, stats };
}
