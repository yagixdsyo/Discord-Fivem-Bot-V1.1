/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getSetting, setSetting } from '../../fivem/lib/state.js';

const DEFAULT_CONFIG = { protectedRoles: [], approvedRoles: [], ignoredRoles: [], logChannelId: null };

async function getConfig(guildId) {
  const raw = (await getSetting(guildId, 'yetki-kontrol.config')) ?? {};
  return { ...DEFAULT_CONFIG, ...raw };
}
async function saveConfig(guildId, patch) {
  const current = await getConfig(guildId);
  const merged = { ...current, ...patch };
  await setSetting(guildId, 'yetki-kontrol.config', merged);
  return merged;
}
function isExempt(member, config) {
  if (member.id === (member.client?.config?.ownerId ?? '')) return true;
  if (member.permissions?.has?.('Administrator')) return true;
  return (config.approvedRoles ?? []).some((r) => member.roles?.cache?.has?.(r));
}
function protectedRoles(member, config) {
  return (config.protectedRoles ?? []).filter((r) => member.roles?.cache?.has?.(r));
}
export async function scanYetki(guild, config) {
  const unauthorized = [];
  if (!(config.protectedRoles ?? []).length) return unauthorized;
  for (const [id, member] of guild.members.cache.entries()) {
    if (member.user?.bot) continue;
    if (isExempt(member, config)) continue;
    const roles = protectedRoles(member, config);
    if (roles.length) unauthorized.push({ member, roles });
  }
  return unauthorized;
}
export async function enforceYetki(client, guild, actorId) {
  const config = await getConfig(guild.id);
  const unauthorized = await scanYetki(guild, config);
  let removed = 0;
  for (const item of unauthorized) {
    for (const roleId of item.roles) {
      if (await item.member.roles.remove(roleId, `Yetki kontrol: ${actorId}`).catch(() => null)) {
        removed += 1;
      }
    }
  }
  return { unauthorized: unauthorized.length, removed, users: unauthorized.map((x) => x.member.id) };
}
export async function addProtectedRole(guildId, roleId) { const c = await getConfig(guildId); const next = [...new Set([...(c.protectedRoles ?? []), roleId])]; await saveConfig(guildId, { protectedRoles: next }); return next; }
export async function removeProtectedRole(guildId, roleId) { const c = await getConfig(guildId); await saveConfig(guildId, { protectedRoles: (c.protectedRoles ?? []).filter((r) => r !== roleId) }); }
export async function addApprovedRole(guildId, roleId) { const c = await getConfig(guildId); const next = [...new Set([...(c.approvedRoles ?? []), roleId])]; await saveConfig(guildId, { approvedRoles: next }); return next; }
export async function removeApprovedRole(guildId, roleId) { const c = await getConfig(guildId); await saveConfig(guildId, { approvedRoles: (c.approvedRoles ?? []).filter((r) => r !== roleId) }); }
export { getConfig, saveConfig };
