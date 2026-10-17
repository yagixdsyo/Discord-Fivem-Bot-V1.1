/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { insertDoc, findDocs, findOneDoc, updateDoc } from '../../fivem/lib/store.js';

const MEETINGS = 'meetings';
const MEETING_ATT = 'meeting_attendance';

export async function createMeeting({ guildId, title, startsAt, voiceChannelId = null, reminders = [30, 5] }) {
  const meetingId = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,4)}`;
  const doc = {
    meeting_id: meetingId,
    guild_id: guildId,
    title,
    starts_at: startsAt.toISOString(),
    voice_channel_id: voiceChannelId,
    reminders,
    status: 'aktif',
    created_at: new Date().toISOString(),
  };
  await insertDoc(MEETINGS, doc);
  return doc;
}

export async function getMeeting(guildId, meetingId) {
  return findOneDoc(MEETINGS, { guild_id: guildId, meeting_id: meetingId });
}

export async function listMeetings(guildId, { active = true } = {}) {
  const filter = { guild_id: guildId };
  if (typeof active === 'boolean') filter.status = active ? 'aktif' : 'tamamlandi';
  return findDocs(MEETINGS, filter, { sort: { starts_at: 1 }, limit: 100 });
}

export async function recordMeetingPresence(guildId, meetingId, memberIds) {
  const doc = await getMeeting(guildId, meetingId);
  if (!doc) return false;
  const present = [...new Set(memberIds)];
  const excused = [];
  for (let i = 0; i < present.length; i++) {
    await insertDoc(MEETING_ATT, { guild_id: guildId, meeting_id: meetingId, user_id: present[i], status: 'katildi', at: new Date().toISOString() }).catch(() => {});
  }
  return true;
}

export async function cancelMeeting(guildId, meetingId) {
  await updateDoc(MEETINGS, { guild_id: guildId, meeting_id: meetingId }, { status: 'iptal' });
  return true;
}

export async function buildMeetingReport(doc, presentCount, absentCount, excusedCount) {
  return [`Katilan: ${presentCount}`, `Katilmayan: ${absentCount}`, `Mazeretli: ${excusedCount}`];
}
