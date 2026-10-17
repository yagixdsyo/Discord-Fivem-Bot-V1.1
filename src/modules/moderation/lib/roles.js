/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getGuildConfig, setGuildSetting } from '../../../core/guildSettings.js';
import { error as errorTemplate } from '../../../ui/templates/index.js';
import { hasDangerousPerms } from '../../guard/lib/punish.js';
import { markSanctioned } from '../../guard/lib/sanction.js';
import { addRoleLog } from './store.js';

const LIMITS_KEY = 'roles.limits';

/** Rol islemi hata karti (sebep kodu yerellestirilir). */
export function roleErrorCard(t, reason) {
  const detail = t(`moderation.role.deny.${reason}`);
  return errorTemplate(t('moderation.errors.role_denied.title'), [
    t('moderation.errors.role_denied.body', {
      sebep: detail && !String(detail).startsWith('moderation.') ? detail : String(reason ?? ''),
    }),
  ]);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Rol siniri tablosu: [{actor_role_id?, user_id?, target_role_ids: []}]. */
export async function getRoleLimits(guildId) {
  try {
    const config = await getGuildConfig(guildId);
    const limits = config?.settings?.[LIMITS_KEY];
    return Array.isArray(limits) ? limits : [];
  } catch {
    return [];
  }
}

export async function setRoleLimits(guildId, limits) {
  return setGuildSetting(guildId, LIMITS_KEY, Array.isArray(limits) ? limits : []);
}

function limitsCover(limits, actorMember, roleId) {
  const roleIdStr = String(roleId);
  for (const entry of limits) {
    if (!entry || typeof entry !== 'object') continue;
    const targets = Array.isArray(entry.target_role_ids) ? entry.target_role_ids.map(String) : [];
    if (!targets.includes(roleIdStr)) continue;
    if (entry.user_id && entry.user_id === actorMember.id) return true;
    if (entry.actor_role_id && actorMember.roles?.cache?.has(entry.actor_role_id)) return true;
  }
  return false;
}

/**
 * Rol verilebilir mi? (verme yonu)
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function canGrantRole({ guild, actorMember, botMember, role }) {
  if (!role) return { ok: false, reason: 'rol_yok' };
  if (!guild?.roles?.cache?.has(role.id)) return { ok: false, reason: 'rol_yok' };
  if (role.id === guild.id) return { ok: false, reason: 'everyone' };
  if (role.managed) return { ok: false, reason: 'managed' };
  if (!botMember) return { ok: false, reason: 'bot_yok' };
  if (botMember.roles.highest.position <= role.position) return { ok: false, reason: 'bot_konum' };

  const isOwner = guild.ownerId === actorMember?.id;
  if (!isOwner && (!actorMember || actorMember.roles.highest.position <= role.position)) {
    return { ok: false, reason: 'aktorden_yuksek' };
  }

  if (hasDangerousPerms(role.permissions?.bitfield)) {
    if (!isOwner) {
      const limits = await getRoleLimits(guild.id);
      if (!limitsCover(limits, actorMember, role.id)) {
        return { ok: false, reason: 'tehlikeli_kisitli' };
      }
    }
  }
  return { ok: true };
}

/** Rol alma (cikarma) icin hiyerarsi kontrolu - tehlikeli kisiti yok. */
export async function canRemoveRole({ guild, actorMember, botMember, role }) {
  if (!role) return { ok: false, reason: 'rol_yok' };
  if (!guild?.roles?.cache?.has(role.id)) return { ok: false, reason: 'rol_yok' };
  if (!botMember) return { ok: false, reason: 'bot_yok' };
  if (botMember.roles.highest.position <= role.position) return { ok: false, reason: 'bot_konum' };
  const isOwner = guild.ownerId === actorMember?.id;
  if (!isOwner && (!actorMember || actorMember.roles.highest.position <= role.position)) {
    return { ok: false, reason: 'aktorden_yuksek' };
  }
  return { ok: true };
}

/**
 * Tek kisiye rol verir (guard isareti + rol logu ile).
 * @returns {Promise<{ok: boolean, reason?: string, error?: string}>}
 */
export async function grantRole({ guild, actorMember, botMember, targetMember, role, reason = null, via = 'komut', actorId = null, actorTag = null }) {
  const check = await canGrantRole({ guild, actorMember, botMember, role });
  if (!check.ok) return check;

  try {
    await markSanctioned({ guildId: guild.id, targetId: targetMember.id, roleIds: [role.id] });
    await targetMember.roles.add(role.id, reason ?? 'Moderasyon: rol verildi');
  } catch (error) {
    return { ok: false, reason: 'discord', error: String(error?.message ?? error) };
  }

  await addRoleLog({
    guildId: guild.id,
    userId: targetMember.id,
    roleId: role.id,
    action: 'ekle',
    actorId: actorId ?? actorMember?.id ?? null,
    actorTag: actorTag ?? null,
    via,
  });
  return { ok: true };
}

/** Tek kisiden rol alir. */
export async function revokeRole({ guild, actorMember, botMember, targetMember, role, reason = null, via = 'komut', actorId = null, actorTag = null }) {
  const check = await canRemoveRole({ guild, actorMember, botMember, role });
  if (!check.ok) return check;

  try {
    await targetMember.roles.remove(role.id, reason ?? 'Moderasyon: rol alındı');
  } catch (error) {
    return { ok: false, reason: 'discord', error: String(error?.message ?? error) };
  }

  await addRoleLog({
    guildId: guild.id,
    userId: targetMember.id,
    roleId: role.id,
    action: 'cikar',
    actorId: actorId ?? actorMember?.id ?? null,
    actorTag: actorTag ?? null,
    via,
  });
  return { ok: true };
}

/**
 * Toplu rol ver/al (ortalama 350 ms arayla; Discord limitlerine saygili).
 * @param {{guild: object, actorMember: object, botMember: object, role: object, userIds: string[], action: 'ekle'|'cikar', reason?: string|null, via?: string, delayMs?: number, onProgress?: Function|null}} input
 * @returns {Promise<{ok: string[], yok: string[], atlanan: string[], hata: Array<{id: string, error: string}>, toplam: number}>}
 */
export async function bulkRole({
  guild,
  actorMember,
  botMember,
  role,
  userIds,
  action,
  reason = null,
  via = 'komut',
  delayMs = 350,
  onProgress = null,
}) {
  const check = action === 'ekle'
    ? await canGrantRole({ guild, actorMember, botMember, role })
    : await canRemoveRole({ guild, actorMember, botMember, role });
  if (!check.ok) return { ok: [], yok: [], atlanan: [], hata: [{ id: '-', error: check.reason }], toplam: userIds.length };

  const result = { ok: [], yok: [], atlanan: [], hata: [], toplam: userIds.length };

  for (const userId of userIds) {
    let member = guild.members.cache.get(userId) ?? null;
    if (!member) {
      try {
        member = await guild.members.fetch(userId);
      } catch {
        member = null;
      }
    }
    if (!member) {
      result.yok.push(userId);
      await wait(delayMs);
      continue;
    }

    const has = member.roles.cache.has(role.id);
    if ((action === 'ekle' && has) || (action === 'cikar' && !has)) {
      result.atlanan.push(userId);
      await wait(delayMs);
      continue;
    }

    try {
      if (action === 'ekle') {
        await markSanctioned({ guildId: guild.id, targetId: member.id, roleIds: [role.id] });
        await member.roles.add(role.id, reason ?? 'Moderasyon: toplu rol');
      } else {
        await member.roles.remove(role.id, reason ?? 'Moderasyon: toplu rol');
      }
      result.ok.push(userId);
      await addRoleLog({
        guildId: guild.id,
        userId,
        roleId: role.id,
        action,
        actorId: actorMember?.id ?? null,
        via,
      });
    } catch (error) {
      result.hata.push({ id: userId, error: String(error?.message ?? error) });
    }

    if (onProgress) {
      try {
        await onProgress(result);
      } catch {
        /* ilerleme karti kritik degil */
      }
    }
    await wait(delayMs);
  }

  return result;
}
