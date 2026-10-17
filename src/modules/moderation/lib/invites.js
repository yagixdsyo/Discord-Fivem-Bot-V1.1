/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { bus } from '../../../core/bus.js';
import { getCollection, isDbReady } from '../../../db/index.js';
import { dayKey } from './util.js';

const MEM = { uses: [] };
const MEM_CAP = 2000;
let subscribed = false;

function nowIso() {
  return new Date().toISOString();
}

function toDay(iso) {
  try {
    return dayKey(new Date(iso));
  } catch {
    return null;
  }
}

/**
 * Katilim kaydi isler (bus 'invite:used').
 * @param {{guildId: string, memberId: string, code: string, inviterId: string|null}} event
 */
export async function recordJoin({ guildId, memberId, code, inviterId }) {
  if (!guildId || !memberId) return null;
  const doc = {
    guild_id: guildId,
    invited_id: memberId,
    inviter_id: inviterId ?? null,
    code: code ?? null,
    joined_at: nowIso(),
    day: toDay(nowIso()),
    left_at: null,
    left: false,
  };

  if (isDbReady()) {
    await getCollection('invite_uses').insertOne({ ...doc });
    await getCollection('invites').updateOne(
      { guild_id: guildId, code: code ?? 'bilinmiyor' },
      {
        $inc: { uses_total: 1 },
        $set: { inviter_id: inviterId ?? null, last_use_at: doc.joined_at },
        $setOnInsert: { created_at: doc.joined_at },
      },
      { upsert: true },
    );
  } else {
    MEM.uses.unshift(doc);
    if (MEM.uses.length > MEM_CAP) MEM.uses.length = MEM_CAP;
  }
  return doc;
}

/** Uye ayrildi isaretle (en son acik davet kaydi). */
export async function recordLeave(guildId, userId) {
  const patch = { left_at: nowIso(), left: true };
  if (isDbReady()) {
    const result = await getCollection('invite_uses').findOneAndUpdate(
      { guild_id: guildId, invited_id: userId, left: false },
      { $set: patch },
    );
    return Boolean(result?.value ?? result);
  }
  const doc = MEM.uses.find((item) => item.guild_id === guildId && item.invited_id === userId && !item.left);
  if (!doc) return false;
  Object.assign(doc, patch);
  return true;
}

/** bus aboneligi (moderation/index.js setup cagirir, tek sefer). */
export function subscribeInviteBus() {
  if (subscribed) return;
  subscribed = true;
  bus.on('invite:used', (event) => {
    recordJoin(event).catch(() => {});
  });
}

/** Test izolasyonu. */
export function clearInviteMemory() {
  MEM.uses.length = 0;
}

/** Sunucuya katilan uyeleri (days gun) davet edene gore gruplu liderlik. */
export async function inviteLeaderboard(guildId, { days = 30, limit = 10 } = {}) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  if (isDbReady()) {
    const rows = await getCollection('invite_uses')
      .aggregate([
        { $match: { guild_id: guildId, joined_at: { $gte: since }, inviter_id: { $ne: null } } },
        { $group: { _id: '$inviter_id', toplam: { $sum: 1 }, kalan: { $sum: { $cond: [{ $eq: ['$left', false] }, 1, 0] } } } },
        { $sort: { toplam: -1 } },
        { $limit: limit },
      ])
      .toArray();
    return rows.map((row) => ({ inviter_id: row._id, toplam: row.toplam, kalan: row.kalan }));
  }

  const map = new Map();
  for (const doc of MEM.uses) {
    if (doc.guild_id !== guildId) continue;
    if (doc.joined_at < since) continue;
    if (!doc.inviter_id) continue;
    const entry = map.get(doc.inviter_id) ?? { inviter_id: doc.inviter_id, toplam: 0, kalan: 0 };
    entry.toplam += 1;
    if (!doc.left) entry.kalan += 1;
    map.set(doc.inviter_id, entry);
  }
  return [...map.values()].sort((a, b) => b.toplam - a.toplam).slice(0, limit);
}

/** Bir uyenin davet ettigi kisiler. */
export async function invitedByUser(guildId, userId, { limit = 20 } = {}) {
  if (isDbReady()) {
    return getCollection('invite_uses')
      .find({ guild_id: guildId, inviter_id: userId })
      .sort({ joined_at: -1 })
      .limit(limit)
      .toArray();
  }
  return MEM.uses
    .filter((doc) => doc.guild_id === guildId && doc.inviter_id === userId)
    .sort((a, b) => String(b.joined_at).localeCompare(String(a.joined_at)))
    .slice(0, limit);
}

/** Bir uyeyi davet eden (en son kayit). */
export async function inviterOfUser(guildId, userId) {
  if (isDbReady()) {
    return getCollection('invite_uses')
      .findOne({ guild_id: guildId, invited_id: userId }, { sort: { joined_at: -1 } });
  }
  return MEM.uses.find((doc) => doc.guild_id === guildId && doc.invited_id === userId) ?? null;
}

/** Bir uyenin toplam davet sayisi. */
export async function inviteCount(guildId, userId) {
  if (isDbReady()) {
    return getCollection('invite_uses').countDocuments({ guild_id: guildId, inviter_id: userId });
  }
  return MEM.uses.filter((doc) => doc.guild_id === guildId && doc.inviter_id === userId).length;
}
