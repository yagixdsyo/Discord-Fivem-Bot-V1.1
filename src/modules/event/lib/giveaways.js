/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { insertDoc, findDocs, findOneDoc, updateDoc } from '../../fivem/lib/store.js';

const GIVEAWAYS = 'giveaways';

export async function createGiveaway({ guildId, creatorId, award, endsAt, winnerCount, conditions = null }) {
  const gid = `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,4)}`;
  const doc = {
    giveaway_id: gid,
    guild_id: guildId,
    creator_id: creatorId,
    award,
    winner_count: Number(winnerCount) || 1,
    ends_at: endsAt.toISOString(),
    conditions,
    status: 'aktif',
    created_at: new Date().toISOString(),
    entrants: [],
    winners: [],
  };
  await insertDoc(GIVEAWAYS, doc);
  return doc;
}

export async function getGiveaway(guildId, giveawayId) {
  return findOneDoc(GIVEAWAYS, { guild_id: guildId, giveaway_id: giveawayId });
}

export function listGiveaways(guildId) {
  return findDocs(GIVEAWAYS, { guild_id: guildId }, { sort: { created_at: -1 }, limit: 100 });
}

export async function enterGiveaway(guildId, giveawayId, userId) {
  const doc = await getGiveaway(guildId, giveawayId);
  if (!doc || doc.status !== 'aktif') return { ok: false, reason: 'closed' };
  if ((doc.entrants ?? []).includes(userId)) return { ok: true, already: true };
  const next = [...(doc.entrants ?? []), userId];
  await updateDoc(GIVEAWAYS, { guild_id: guildId, giveaway_id: giveawayId }, { entrants: next });
  return { ok: true, already: false };
}

export async function pickWinners(entrants, count) {
  const pool = [...entrants];
  const winners = [];
  const max = Math.max(1, Math.min(count, pool.length));
  while (winners.length < max && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }
  return winners;
}

export async function finalizeGiveaway(client, guildId, giveawayId) {
  const doc = await getGiveaway(guildId, giveawayId);
  if (!doc || doc.status !== 'aktif') return false;
  const winners = await pickWinners(doc.entrants ?? [], doc.winner_count ?? 1);
  await updateDoc(GIVEAWAYS, { guild_id: guildId, giveaway_id: giveawayId }, {
    status: 'tamamlandi',
    winners,
    ended_at: new Date().toISOString(),
  });
  return winners;
}
