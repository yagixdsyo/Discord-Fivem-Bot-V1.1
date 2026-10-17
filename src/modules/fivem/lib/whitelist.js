/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getSetting, setSetting } from './state.js';
import { findDocs, findOneDoc, insertDoc, updateDoc } from './store.js';
import { getRoleId } from './maps.js';
import { markSanctioned } from '../../guard/lib/sanction.js';
import { addRoleLog } from '../../moderation/lib/store.js';

export const NAME_TEMPLATE_KEY = 'fivem.whitelist.nameTemplate';
export const DEFAULT_NAME_TEMPLATE = '{isim} / Giriniz !!';
const NAME_REQUESTS = 'name_requests';

export async function getNameTemplate(guildId) {
  const raw = await getSetting(guildId, NAME_TEMPLATE_KEY);
  return typeof raw === 'string' && raw.trim() ? raw : DEFAULT_NAME_TEMPLATE;
}

export async function setNameTemplate(guildId, template) {
  const value = String(template ?? '').trim() || DEFAULT_NAME_TEMPLATE;
  return setSetting(guildId, NAME_TEMPLATE_KEY, value);
}

/** Sablondaki {isim} degiskenini doldurur; Discord nick limiti 32. */
export function renderName(template, isim) {
  const name = String(template ?? DEFAULT_NAME_TEMPLATE).replaceAll('{isim}', String(isim ?? '').trim());
  return name.slice(0, 32);
}

/** Hedef uyede whitelist rolunu verir + ismi sablonla ayarlar; sonucu doner. */
export async function applyWhitelist(guild, { member, actorId, isim = null }) {
  const roleId = await getRoleId(guild.id, 'whitelist');
  if (!roleId) return { ok: false, error: 'rol_yok' };

  const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
  if (!role) return { ok: false, error: 'rol_yok' };

  const me = guild.members.me;
  if (!me || me.roles.highest.position <= role.position) return { ok: false, error: 'bot_konum' };

  try {
    if (!member.roles.cache.has(roleId)) {
      await markSanctioned({ guildId: guild.id, targetId: member.id, roleIds: [roleId] }).catch(() => {});
      await member.roles.add(roleId, `Whitelist: ${actorId}`);
      await addRoleLog({
        guildId: guild.id,
        userId: member.id,
        roleId,
        action: 'ekle',
        actorId,
        via: 'komut',
      }).catch(() => {});
    }

    if (isim) {
      const nick = renderName(await getNameTemplate(guild.id), isim);
      await member.setNickname(nick, 'Whitelist ismi').catch(() => {});
    }
    return { ok: true, roleId };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

/** Whitelist rolunu alir. */
export async function removeWhitelist(guild, { member, actorId }) {
  const roleId = await getRoleId(guild.id, 'whitelist');
  if (!roleId) return { ok: false, error: 'rol_yok' };

  const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
  if (!role) return { ok: false, error: 'rol_yok' };

  const me = guild.members.me;
  if (!me || me.roles.highest.position <= role.position) return { ok: false, error: 'bot_konum' };

  try {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId, `Whitelist kaldir: ${actorId}`);
      await addRoleLog({
        guildId: guild.id,
        userId: member.id,
        roleId,
        action: 'cikar',
        actorId,
        via: 'komut',
      }).catch(() => {});
    }
    return { ok: true, roleId };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

// ---------------------------------------------------------------------------
// IC / OOC isim onay talepleri
// ---------------------------------------------------------------------------

export async function createNameRequest({ guildId, userId, userTag = null, kind, name, requestId }) {
  const doc = {
    guild_id: guildId,
    request_id: requestId,
    user_id: userId,
    user_tag: userTag,
    kind,
    name,
    status: 'beklemede',
    decided_by: null,
    decided_at: null,
  };
  await insertDoc(NAME_REQUESTS, doc);
  return doc;
}

export async function getNameRequest(guildId, requestId) {
  return findOneDoc(NAME_REQUESTS, { guild_id: guildId, request_id: requestId });
}

export async function decideNameRequest(guildId, requestId, { status, by, note = null }) {
  const doc = await getNameRequest(guildId, requestId);
  if (!doc) return { ok: false, error: 'talep_yok' };
  if (doc.status !== 'beklemede') return { ok: false, error: 'zaten_karar' };

  await updateDoc(
    NAME_REQUESTS,
    { guild_id: guildId, request_id: requestId, status: 'beklemede' },
    { status, decided_by: by, decided_at: new Date().toISOString(), decision_note: note },
  );
  return { ok: true, doc: { ...doc, status, decided_by: by } };
}

export async function listNameRequests(guildId, { status = null, limit = 20 } = {}) {
  const filter = { guild_id: guildId };
  if (status) filter.status = status;
  return findDocs(NAME_REQUESTS, filter, { sort: { created_at: -1 }, limit });
}
