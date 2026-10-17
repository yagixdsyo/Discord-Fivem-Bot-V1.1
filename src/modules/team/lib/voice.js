/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { insertDoc, findDocs, updateDoc } from '../../fivem/lib/store.js';

const SESSIONS = 'team_voice_sessions';
const MAX_OPEN_HOURS = 12;

function sessionId() {
  return `vs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Ses durumu degisimini isler: eski kanaldaki acik oturum kapatilir,
 * yeni kanal icin oturum acilir.
 */
export async function onVoiceUpdate({ guildId, userId, oldChannelId = null, newChannelId = null }) {
  if (!guildId || !userId) return false;
  if (oldChannelId === newChannelId) return false;

  if (oldChannelId) {
    const open = await findDocs(
      SESSIONS,
      { guild_id: guildId, user_id: userId, channel_id: oldChannelId, left_at: null },
      { sort: { joined_at: -1 }, limit: 5 },
    );
    for (const doc of open) {
      const joinedAt = new Date(doc.joined_at).getTime();
      const seconds = Math.max(0, Math.floor((Date.now() - joinedAt) / 1000));
      await updateDoc(
        SESSIONS,
        { guild_id: guildId, session_id: doc.session_id },
        { left_at: new Date().toISOString(), duration_seconds: seconds },
      );
    }
  }

  if (newChannelId) {
    await insertDoc(SESSIONS, {
      session_id: sessionId(),
      guild_id: guildId,
      user_id: userId,
      channel_id: newChannelId,
      joined_at: new Date().toISOString(),
      left_at: null,
      duration_seconds: 0,
    });
  }
  return true;
}

/** Oturum suresi (saniye); acik oturumda simdiki zamanla, 12 saatle sinirli. */
export function sessionSeconds(doc, now = Date.now()) {
  if (doc.left_at) return Math.max(0, Number(doc.duration_seconds) || 0);
  const joinedAt = new Date(doc.joined_at).getTime();
  const cap = joinedAt + MAX_OPEN_HOURS * 3600_000;
  return Math.max(0, Math.floor((Math.min(now, cap) - joinedAt) / 1000));
}

/** Saniyeyi okunabilir sureye cevirir (2 sa 34 dk gibi). */
export function formatSeconds(total) {
  const s = Math.max(0, Math.floor(Number(total) || 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (hours > 0) return `${hours} sa ${minutes} dk`;
  if (minutes > 0) return `${minutes} dk`;
  return `${s} sn`;
}

/**
 * Verilen kullanicilar icin donem icindeki ses saniyelerini toplar.
 * @returns {Promise<Map<string, number>>} userId -> saniye
 */
export async function voiceSummary({ guildId, userIds, days = 7, channelIds = null }) {
  const safeDays = Math.min(Math.max(Number(days) || 7, 1), 90);
  const since = new Date(Date.now() - safeDays * 86400_000).toISOString();
  const totals = new Map(userIds.map((id) => [id, 0]));
  for (const userId of userIds) {
    const docs = await findDocs(
      SESSIONS,
      { guild_id: guildId, user_id: userId, joined_at: { $gte: since } },
      { sort: { joined_at: -1 }, limit: 500 },
    );
    let total = 0;
    for (const doc of docs) {
      if (Array.isArray(channelIds) && channelIds.length && !channelIds.includes(doc.channel_id)) continue;
      total += sessionSeconds(doc);
    }
    totals.set(userId, total);
  }
  return totals;
}
