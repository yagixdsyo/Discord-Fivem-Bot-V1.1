/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { PermissionFlagsBits } from 'discord.js';
import { isGuildBlacklisted } from '../../../core/ownerGate.js';

/** Sunucudan on kontrol gerceklerini toplar. */
export async function collectPrecheck(guild, { store } = {}) {
  const me =
    guild.members?.me ??
    (await guild.members.fetch(guild.client.user.id).catch(() => null));

  const perms = me?.permissions;
  const has = (flag) => Boolean(perms?.has?.(flag));

  let existingRoles = 0;
  let existingChannels = 0;
  if (store) {
    try {
      existingRoles = (await store.getMap('roles_map', guild.id)).length;
      existingChannels = (await store.getMap('channels_map', guild.id)).length;
    } catch {
      /* yut */
    }
  }

  let blacklisted = false;
  try {
    blacklisted = await isGuildBlacklisted(guild.id);
  } catch {
    /* yut */
  }

  return {
    isAdmin: has(PermissionFlagsBits.Administrator),
    canManageChannels: has(PermissionFlagsBits.ManageChannels),
    canManageRoles: has(PermissionFlagsBits.ManageRoles),
    canManageWebhooks: has(PermissionFlagsBits.ManageWebhooks),
    highestRolePosition: me?.roles?.highest?.position ?? 0,
    existingRoles,
    existingChannels,
    blacklisted,
  };
}

/**
 * Saf karar fonksiyonu.
 * @returns {{ok: boolean, problems: Array<{code: string}>, warnings: Array<{code: string}>, hasExisting: boolean, existingRoles: number, existingChannels: number}}
 */
export function evaluatePrecheck(facts = {}) {
  const problems = [];
  const warnings = [];

  if (facts.blacklisted) problems.push({ code: 'kara_liste' });
  if (!facts.isAdmin) {
    if (!facts.canManageChannels) problems.push({ code: 'izin_kanal_yonetimi' });
    if (!facts.canManageRoles) problems.push({ code: 'izin_rol_yonetimi' });
  }
  if ((facts.highestRolePosition ?? 0) <= 1) {
    warnings.push({ code: 'hiyerarsi_dusuk' });
  }
  if (!facts.isAdmin && !facts.canManageWebhooks) {
    warnings.push({ code: 'webhook_yok' });
  }

  const existingRoles = facts.existingRoles ?? 0;
  const existingChannels = facts.existingChannels ?? 0;

  return {
    ok: problems.length === 0,
    problems,
    warnings,
    hasExisting: existingRoles > 0 || existingChannels > 0,
    existingRoles,
    existingChannels,
  };
}
