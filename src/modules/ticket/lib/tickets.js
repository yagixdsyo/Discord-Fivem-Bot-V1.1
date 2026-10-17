/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  clearFivemMemory,
  countDocs,
  deleteDocs,
  findDocs,
  findOneDoc,
  insertDoc,
  updateDoc,
} from '../../fivem/lib/store.js';

const COL = 'tickets';
const NOTES = 'ticket_notes';
const RATINGS = 'ticket_ratings';

function nowIso() { return new Date().toISOString(); }
function newTicketId() { return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`; }

export async function ticketCount(guildId) {
  return countDocs(COL, { guild_id: guildId });
}

export async function createTicket({ guildId, channelId, userId, createdBy, category = 'destek', subject = null }) {
  const n = (await ticketCount(guildId)) + 1;
  const doc = {
    ticket_id: newTicketId(),
    guild_id: guildId,
    channel_id: channelId,
    user_id: userId,
    category,
    subject,
    status: 'acik',
    number: n,
    opened_at: nowIso(),
    opened_by: createdBy ?? userId,
    closed_at: null,
    closed_by: null,
    close_reason: null,
    claimed_by: null,
    claimed_at: null,
    participants: [userId],
    reopen_count: 0,
  };
  await insertDoc(COL, doc);
  return doc;
}

export async function getTicket(guildId, ticketId) {
  return findOneDoc(COL, { guild_id: guildId, ticket_id: ticketId });
}

export async function getTicketByIdOnly(ticketId) {
  return findOneDoc(COL, { ticket_id: ticketId });
}

export async function getTicketByChannel(channelId) {
  return findOneDoc(COL, { channel_id: channelId });
}

export async function findOpenByUser(guildId, userId) {
  return findOneDoc(COL, { guild_id: guildId, user_id: userId, status: 'acik' });
}

export async function listTickets(guildId, { status = null, userId = null, limit = 50 } = {}) {
  const filter = { guild_id: guildId };
  if (status) filter.status = status;
  if (userId) filter.user_id = userId;
  return findDocs(COL, filter, { sort: { opened_at: -1 }, limit });
}

export async function claimTicket(guildId, ticketId, { by }) {
  const doc = await getTicket(guildId, ticketId);
  if (!doc) return { ok: false, error: 'yok' };
  if (doc.claimed_by && doc.claimed_by !== by) {
    return { ok: false, error: 'zaten_alinmis' };
  }
  await updateDoc(COL, { guild_id: guildId, ticket_id: ticketId }, { claimed_by: by, claimed_at: nowIso() });
  return { ok: true, doc: await getTicket(guildId, ticketId) };
}

export async function setClaimed(guildId, ticketId, by) {
  await updateDoc(COL, { guild_id: guildId, ticket_id: ticketId }, { claimed_by: by, claimed_at: nowIso() });
  return { ok: true };
}

export async function closeTicket({ guildId, ticketId, by, reason = null }) {
  const doc = await getTicket(guildId, ticketId);
  if (!doc) return { ok: false, error: 'yok' };
  if (doc.status === 'kapali') return { ok: false, error: 'zaten_kapali' };
  const patch = { status: 'kapali', closed_at: nowIso(), closed_by: by, close_reason: reason };
  await updateDoc(COL, { guild_id: guildId, ticket_id: ticketId }, patch);
  return { ok: true, doc: await getTicket(guildId, ticketId) };
}

export async function reopenTicket(guildId, ticketId, { by }) {
  const doc = await getTicket(guildId, ticketId);
  if (!doc) return { ok: false, error: 'yok' };
  if (doc.status !== 'kapali') return { ok: false, error: 'zaten_acik' };
  await updateDoc(COL, { guild_id: guildId, ticket_id: ticketId }, { status: 'acik', closed_at: null, closed_by: null, reopen_count: (doc.reopen_count ?? 0) + 1 });
  return { ok: true, doc: await getTicket(guildId, ticketId) };
}

export async function addParticipant(guildId, ticketId, userId) {
  const doc = await getTicket(guildId, ticketId);
  if (!doc) return false;
  const participants = Array.isArray(doc.participants) ? doc.participants : [doc.user_id];
  if (participants.includes(userId)) return true;
  participants.push(userId);
  await updateDoc(COL, { guild_id: guildId, ticket_id: ticketId }, { participants });
  return true;
}

export async function removeParticipant(guildId, ticketId, userId) {
  const doc = await getTicket(guildId, ticketId);
  if (!doc) return false;
  const participants = (doc.participants ?? []).filter((u) => u !== userId);
  await updateDoc(COL, { guild_id: guildId, ticket_id: ticketId }, { participants });
  return true;
}

export async function markNote(guildId, ticketId, { by, note }) {
  await insertDoc(NOTES, { guild_id: guildId, ticket_id: ticketId, by, note, at: nowIso() });
  return true;
}

export async function listNotes(guildId, ticketId, { limit = 50 } = {}) {
  return findDocs(NOTES, { guild_id: guildId, ticket_id: ticketId }, { sort: { at: -1 }, limit });
}

export async function rateTicket(guildId, ticketId, { score, comment = null }) {
  const clipped = Math.max(1, Math.min(5, Number(score) || 1));
  const existing = await findOneDoc(RATINGS, { guild_id: guildId, ticket_id: ticketId });
  if (existing) {
    await updateDoc(RATINGS, { guild_id: guildId, ticket_id: ticketId }, { score: clipped, comment: comment ?? null, updated_at: nowIso() });
  } else {
    await insertDoc(RATINGS, { guild_id: guildId, ticket_id: ticketId, score: clipped, comment: comment ?? null, rated_at: nowIso() });
  }
  return { ok: true, score: clipped };
}

export async function ticketRatingStats(guildId, { staffId = null } = {}) {
  const tickets = await listTickets(guildId, { status: 'kapali', limit: 200 });
  const ids = tickets.map((t) => t.ticket_id);
  const ratings = ids.length ? await findDocs(RATINGS, { guild_id: guildId, ticket_id: { $in: ids } }) : [];
  const map = new Map(ratings.map((r) => [r.ticket_id, r]));
  const byStaff = new Map();
  for (const ticket of tickets) {
    const rating = map.get(ticket.ticket_id);
    if (!rating) continue;
    const staff = ticket.closed_by ?? ticket.claimed_by ?? 'bilinmiyor';
    if (staffId && staff !== staffId) continue;
    const entry = byStaff.get(staff) ?? { staff, sayac: 0, toplam: 0 };
    entry.sayac += 1;
    entry.toplam += rating.score;
    byStaff.set(staff, entry);
  }
  return [...byStaff.values()].map((entry) => ({ ...entry, ortalama: entry.toplam / entry.sayac }));
}

export async function removeTicket(guildId, ticketId) {
  await deleteDocs(NOTES, { guild_id: guildId, ticket_id: ticketId });
  await deleteDocs(RATINGS, { guild_id: guildId, ticket_id: ticketId });
  return deleteDocs(COL, { guild_id: guildId, ticket_id: ticketId });
}

export { clearFivemMemory as clearTicketMemory } from '../../fivem/lib/store.js';

export async function ticketSpeedStats(guildId, { staffId = null } = {}) {
  const tickets = await listTickets(guildId, { status: 'kapali', limit: 500 });
  const stats = new Map();
  for (const t of tickets) {
    if (!t.claimed_at || !t.opened_at) continue;
    if (staffId && (t.closed_by ?? t.claimed_by) !== staffId) continue;
    const seconds = Math.max(0, (new Date(t.claimed_at).getTime() - new Date(t.opened_at).getTime()) / 1000);
    const owner = t.claimed_by ?? t.closed_by ?? 'bilinmiyor';
    const entry = stats.get(owner) || { staff: owner, adet: 0, toplam: 0, enHizli: Infinity };
    entry.adet += 1;
    entry.toplam += seconds;
    entry.enHizli = Math.min(entry.enHizli, seconds);
    stats.set(owner, entry);
  }
  return [...stats.values()].map((x) => ({
    staff: x.staff,
    adet: x.adet,
    ortalamaSn: x.adet ? x.toplam / x.adet : 0,
    enHizliSn: Number.isFinite(x.enHizli) ? x.enHizli : 0,
  })).sort((a, b) => a.ortalamaSn - b.ortalamaSn);
}
