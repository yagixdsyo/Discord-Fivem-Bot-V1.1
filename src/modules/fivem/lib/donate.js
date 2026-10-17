/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getSetting, setSetting } from './state.js';
import { findDocs, findOneDoc, insertDoc, updateDoc, deleteDocs } from './store.js';

const COL = 'donate_records';
export const DONATE_INFO_KEY = 'fivem.donate.info';

const DEFAULT_INFO = Object.freeze({
  intro: 'Sunucumuzu desteklemek icin asagidaki paketlerden birini alabilirsin.',
  packages: [
    { name: 'VIP', price: '100 TL', desc: 'VIP rol + ekstra arac slotu' },
    { name: 'VIP+', price: '250 TL', desc: 'VIP + ozel arac + oncelikli destek' },
  ],
  methods: ['Havale / EFT', 'Papara'],
  contact: 'Yetkililere ticket acarak ulasabilirsin.',
});

export async function getDonateInfo(guildId) {
  const raw = await getSetting(guildId, DONATE_INFO_KEY);
  if (raw && typeof raw === 'object' && Array.isArray(raw.packages)) return raw;
  return DEFAULT_INFO;
}

export async function setDonateInfo(guildId, info) {
  return setSetting(guildId, DONATE_INFO_KEY, info);
}

export async function addDonate({ guildId, userId, userTag = null, paket, amount = null, note = null, actorId, actorTag = null }) {
  const doc = {
    donate_id: `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    guild_id: guildId,
    user_id: userId,
    user_tag: userTag,
    package: String(paket ?? '').slice(0, 100),
    amount: amount ? String(amount).slice(0, 50) : null,
    note: note ? String(note).slice(0, 300) : null,
    actor_id: actorId,
    actor_tag: actorTag,
  };
  await insertDoc(COL, doc);
  return doc;
}

export async function listDonates(guildId, { userId = null, limit = 25 } = {}) {
  const filter = { guild_id: guildId };
  if (userId) filter.user_id = userId;
  return findDocs(COL, filter, { sort: { created_at: -1 }, limit });
}

export async function getDonate(guildId, donateId) {
  return findOneDoc(COL, { guild_id: guildId, donate_id: donateId });
}

/** Kayit alanlarini gunceller (paket/amount/note); degisiklik yoksa false. */
export async function updateDonate(guildId, donateId, patch = {}) {
  const clean = {};
  if (patch.paket !== undefined) clean.package = String(patch.paket ?? '').slice(0, 100);
  if (patch.amount !== undefined) clean.amount = patch.amount ? String(patch.amount).slice(0, 50) : null;
  if (patch.note !== undefined) clean.note = patch.note ? String(patch.note).slice(0, 300) : null;
  if (Object.keys(clean).length === 0) return false;
  return updateDoc(COL, { guild_id: guildId, donate_id: donateId }, clean);
}

export async function removeDonate(guildId, donateId) {
  const removed = await deleteDocs(COL, { guild_id: guildId, donate_id: donateId });
  return removed > 0;
}
