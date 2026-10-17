/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getSetting, setSetting } from './state.js';
import { findDocs, findOneDoc, insertDoc, updateDoc } from './store.js';

// ---------------------------------------------------------------------------
// Kurallar
// ---------------------------------------------------------------------------

export const RULES_KEY = 'fivem.rules';

/**
 * Metni sayfalara ayirir: "# Baslik" satirlari yeni sayfa baslatir.
 * @returns {Array<{title: string, lines: string[]}>}
 */
export function parseRules(text) {
  const pages = [];
  let current = null;
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const head = /^#+\s*(.+)$/.exec(line);
    if (head) {
      current = { title: head[1].slice(0, 100), lines: [] };
      pages.push(current);
      continue;
    }
    if (!current) {
      current = { title: 'Kurallar', lines: [] };
      pages.push(current);
    }
    current.lines.push(line.slice(0, 400));
    if (current.lines.length >= 15) current = null;
  }
  return pages.filter((page) => page.lines.length > 0).slice(0, 10);
}

export async function setRules(guildId, pages) {
  return setSetting(guildId, RULES_KEY, { pages });
}

export async function getRules(guildId) {
  const raw = await getSetting(guildId, RULES_KEY);
  const pages = Array.isArray(raw?.pages) ? raw.pages : [];
  return pages;
}

// ---------------------------------------------------------------------------
// Oylama
// ---------------------------------------------------------------------------

const POLLS = 'polls';

export async function createPoll({ guildId, question, options, multi = false, endsAt = null, ownerId, channelId = null }) {
  const doc = {
    poll_id: `oy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    guild_id: guildId,
    question: String(question).slice(0, 200),
    options: options.map((option) => String(option).slice(0, 80)).slice(0, 10),
    multi: Boolean(multi),
    votes: {},
    status: 'acik',
    owner_id: ownerId,
    channel_id: channelId,
    message_id: null,
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
  };
  await insertDoc(POLLS, doc);
  return doc;
}

export async function getPoll(guildId, pollId) {
  return findOneDoc(POLLS, { guild_id: guildId, poll_id: pollId });
}

export async function setPollMessage(guildId, pollId, { channelId, messageId }) {
  return updateDoc(POLLS, { guild_id: guildId, poll_id: pollId }, { channel_id: channelId, message_id: messageId });
}

/** Oy verir: multi=false ise tek secim (toggle). */
export async function votePoll(guildId, pollId, userId, indexes) {
  const doc = await getPoll(guildId, pollId);
  if (!doc) return { ok: false, error: 'oylama_yok' };
  if (doc.status !== 'acik') return { ok: false, error: 'kapali' };

  const current = Array.isArray(doc.votes?.[userId]) ? doc.votes[userId] : [];
  const requested = [...new Set(indexes.filter((i) => i >= 0 && i < doc.options.length))];
  let next;
  if (doc.multi) {
    next = requested; // coklu secim: istenen kume yazilir
  } else {
    next = current.includes(requested[0]) ? [] : requested.slice(0, 1); // tekrar tiklamada geri al
  }

  const votes = { ...(doc.votes ?? {}) };
  if (next.length === 0) delete votes[userId];
  else votes[userId] = next;

  await updateDoc(POLLS, { guild_id: guildId, poll_id: pollId }, { votes });
  return { ok: true, doc: { ...doc, votes }, myVotes: next };
}

export async function closePoll(guildId, pollId, { by = null } = {}) {
  const doc = await getPoll(guildId, pollId);
  if (!doc) return { ok: false, error: 'oylama_yok' };
  await updateDoc(POLLS, { guild_id: guildId, poll_id: pollId }, { status: 'kapali', closed_by: by });
  return { ok: true, doc: { ...doc, status: 'kapali' } };
}

export async function listPolls(guildId, { status = null, limit = 15 } = {}) {
  const filter = { guild_id: guildId };
  if (status) filter.status = status;
  return findDocs(POLLS, filter, { sort: { created_at: -1 }, limit });
}

/** Sonuc cubuklari: [{index, text, count, percent}] */
export function pollResults(doc) {
  const counts = new Array(doc.options.length).fill(0);
  for (const picks of Object.values(doc.votes ?? {})) {
    for (const index of picks) {
      if (index >= 0 && index < counts.length) counts[index] += 1;
    }
  }
  const total = counts.reduce((acc, value) => acc + value, 0);
  return counts.map((count, index) => {
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    const filled = Math.round(percent / 10);
    return {
      index,
      text: doc.options[index],
      count,
      percent,
      bar: `${'▰'.repeat(filled)}${'▱'.repeat(Math.max(0, 10 - filled))}`,
    };
  });
}
