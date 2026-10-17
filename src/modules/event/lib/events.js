/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { insertDoc, findDocs, findOneDoc, updateDoc } from '../../fivem/lib/store.js';
import { getSetting, setSetting } from '../../fivem/lib/state.js';

const EVENTS = 'events';

export async function createEvent({ guildId, creatorId, title, description, startsAt, capacity, channelIds = [] }) {
  const eventId = `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,4)}`;
  const doc = {
    event_id: eventId,
    guild_id: guildId,
    creator_id: creatorId,
    title,
    description: description || null,
    starts_at: startsAt.toISOString(),
    capacity: capacity || null,
    reminder_sent: { t30: false, t5: false, start: false },
    participants: { going: [], maybe: [], not: [], banned: [] },
    channel_ids: channelIds,
    status: 'aktif',
    created_at: new Date().toISOString(),
  };
  await insertDoc(EVENTS, doc);
  return doc;
}

export async function getEvent(guildId, eventId) {
  return findOneDoc(EVENTS, { guild_id: guildId, event_id: eventId });
}

export async function respondEvent({ guildId, eventId, userId, response }) {
  const doc = await getEvent(guildId, eventId);
  if (!doc || doc.status !== 'aktif') return false;
  for (const key of ['going', 'maybe', 'not']) {
    const idx = (doc.participants?.[key] ?? []).indexOf(userId);
    if (idx >= 0) doc.participants[key].splice(idx, 1);
  }
  if (response === 'going' && doc.participants.going.includes(userId)) return doc;
  doc.participants[response] ??= [];
  if (!doc.participants[response].includes(userId)) doc.participants[response].push(userId);
  await updateDoc(EVENTS, { guild_id: guildId, event_id: eventId }, { participants: doc.participants });
  return doc;
}

export async function cancelEvent(guildId, eventId, actorId) {
  await updateDoc(EVENTS, { guild_id: guildId, event_id: eventId }, { status: 'iptal', cancelled_by: actorId, cancelled_at: new Date().toISOString() });
  return true;
}

export async function finishEvent(guildId, eventId) {
  await updateDoc(EVENTS, { guild_id: guildId, event_id: eventId }, { status: 'bitti', finished_at: new Date().toISOString() });
  return true;
}

export async function listEvents(guildId) {
  return findDocs(EVENTS, { guild_id: guildId }, { sort: { starts_at: 1 }, limit: 100 });
}

export async function buildParticipantsText(doc) {
  const g = doc.participants?.going ?? [];
  const m = doc.participants?.maybe ?? [];
  const n = doc.participants?.not ?? [];
  return [
    `Katılıyor: ${g.length ? g.map((u) => `<@${u}>`).join(', ') : '-'}`,
    `Belki: ${m.length ? m.map((u) => `<@${u}>`).join(', ') : '-'}`,
    `Katılmıyor: ${n.length ? n.map((u) => `<@${u}>`).join(', ') : '-'}`,
  ];
}
