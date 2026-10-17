/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../db/index.js';
import { getRedis, isRedisReady } from './redis.js';
import { info as infoTemplate } from '../ui/templates/index.js';

export const ANNOUNCE_KINDS = Object.freeze(['guncelleme', 'yenilik', 'bakim']);

/** Form/metin alanlarini dogrular (saf fonksiyon - birim testli). */
export function validateAnnouncementInput({ title, body, version } = {}) {
  const errors = [];
  const cleanTitle = String(title ?? '').trim();
  const cleanBody = String(body ?? '').trim();
  const cleanVersion = version === null || version === undefined || String(version).trim() === ''
    ? null
    : String(version).trim();

  if (!cleanTitle) errors.push('title_empty');
  else if (cleanTitle.length > 100) errors.push('title_long');
  if (!cleanBody) errors.push('body_empty');
  else if (cleanBody.length > 2000) errors.push('body_long');
  if (cleanVersion && !/^[0-9a-zA-Z._-]{1,20}$/.test(cleanVersion)) errors.push('version_invalid');

  return {
    ok: errors.length === 0,
    errors,
    value: { title: cleanTitle, body: cleanBody, version: cleanVersion },
  };
}

/** ObjectId'nin son 6 karakteri - kullaniciya gosterilen kisa id. */
export function shortId(doc) {
  const raw = doc?._id?.toString?.() ?? '';
  return raw.slice(-6);
}

/** Duyuru olusturur (varsayilan: gizli). */
export async function createAnnouncement({ kind, title, body, version = null, createdBy = null }) {
  if (!ANNOUNCE_KINDS.includes(kind)) return { ok: false, error: 'tur_gecersiz' };
  const check = validateAnnouncementInput({ title, body, version });
  if (!check.ok) return { ok: false, error: 'dogrulama', errors: check.errors };
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };

  const doc = {
    kind,
    title: check.value.title,
    body: check.value.body,
    version: check.value.version,
    visible: false,
    created_by: createdBy,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const result = await getCollection('owner_announcements').insertOne(doc);
  return { ok: true, id: result.insertedId, shortId: shortId({ _id: result.insertedId }) };
}

/** Duyuruyu gunceller. */
export async function updateAnnouncement(id, { title, body, version = null }) {
  const check = validateAnnouncementInput({ title, body, version });
  if (!check.ok) return { ok: false, error: 'dogrulama', errors: check.errors };
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };
  const result = await getCollection('owner_announcements').updateOne(
    { _id: id },
    { $set: { ...check.value, updated_at: new Date().toISOString() } },
  );
  return { ok: result.matchedCount > 0 };
}

/** Duyuruyu siler. */
export async function deleteAnnouncement(id) {
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };
  const result = await getCollection('owner_announcements').deleteOne({ _id: id });
  return { ok: result.deletedCount > 0 };
}

/** Gorunurluk ac/kapat. */
export async function setAnnouncementVisible(id, visible) {
  if (!isDbReady()) return { ok: false, error: 'db_hazir_degil' };
  const result = await getCollection('owner_announcements').updateOne(
    { _id: id },
    { $set: { visible: Boolean(visible), updated_at: new Date().toISOString() } },
  );
  return { ok: result.matchedCount > 0 };
}

/** En son duyuru (istege gore yalnizca gorunur olanlar). */
export async function getLatestAnnouncement(kind, { visibleOnly = false } = {}) {
  if (!isDbReady()) return null;
  const query = { kind };
  if (visibleOnly) query.visible = true;
  try {
    return await getCollection('owner_announcements').findOne(query, { sort: { created_at: -1 } });
  } catch {
    return null;
  }
}

/** Gecmis duyurular (en yeni once). */
export async function listAnnouncements(kind, limit = 10) {
  if (!isDbReady()) return [];
  try {
    return await getCollection('owner_announcements')
      .find({ kind })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
  } catch {
    return [];
  }
}

/** Kisa id (son 6 hex) ile duyuru bulur. */
export async function findByShortId(kind, short) {
  const list = await listAnnouncements(kind, 100);
  const wanted = String(short ?? '').toLowerCase();
  return list.find((doc) => shortId(doc) === wanted) ?? null;
}

/** Bakim duyurusunu bakim moduna baglar: baslarken acar, bitince kapatir. */
export async function setMaintenanceAnnouncementLinked(visible) {
  const latest = await getLatestAnnouncement('bakim');
  if (!latest) return null;
  await setAnnouncementVisible(latest._id, visible);
  return latest;
}

/**
 * Aktif guncelleme duyurusu varsa ve kullanici gormediyse kucuk bildirim gonderir.
 * Kullanici basina duyuru basina BIR kez (Redis, 90 gun).
 * @param {object} ctx komut baglami
 */
export async function maybeAutoNotify(ctx) {
  try {
    if (!ctx?.user?.id) return;
    const ann = await getLatestAnnouncement('guncelleme', { visibleOnly: true });
    if (!ann) return;
    if (!isRedisReady()) return;

    const key = `announce:seen:${ctx.user.id}:${ann._id}`;
    const seen = await getRedis().get(key);
    if (seen) return;

    const card = infoTemplate(ctx.t('announce.new_update_title'), [ann.title]);
    await ctx.followUp(card, { ephemeral: ctx.source === 'slash' });
    await getRedis().set(key, '1', 'EX', 90 * 24 * 3600);
  } catch {
    /* bildirim kritik degil */
  }
}
