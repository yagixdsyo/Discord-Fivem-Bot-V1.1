/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

const URL_RE = /\bhttps?:\/\/[^\s<>()\[\]{}"']+/gi;

/** Metindeki URL'leri cikarir. */
export function extractUrls(content) {
  const text = String(content ?? '');
  const matches = text.match(URL_RE);
  if (!matches) return [];
  return [...new Set(matches.map((url) => url.replace(/[.,!?;:]+$/, '')))];
}

export function hostOf(url) {
  try {
    const parsed = new URL(url.includes('://') ? url : `https://${url}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function isInviteUrl(url) {
  const host = hostOf(url);
  if (!host) return false;
  if (host === 'discord.gg' || host === 'discordapp.com' || host === 'discord.me') return true;
  if ((host === 'discord.com' || host === 'discordapp.com') && /\/invite\//i.test(String(url))) return true;
  return false;
}

function hostAllowed(host, whitelist) {
  if (!host) return false;
  for (const entry of whitelist ?? []) {
    const domain = String(entry ?? '').toLowerCase().replace(/^www\./, '');
    if (!domain) continue;
    if (host === domain || host.endsWith(`.${domain}`)) return true;
  }
  return false;
}

/**
 * Link ihlali var mi?
 * @param {string} content
 * @param {{ whitelist?: string[], blockAllLinks?: boolean }} [opts]
 * @returns {{url: string, host: string|null, kind: 'davet'|'link'}|null}
 */
export function findLinkViolation(content, { whitelist = [], blockAllLinks = false } = {}) {
  for (const url of extractUrls(content)) {
    const host = hostOf(url);
    if (hostAllowed(host, whitelist)) continue;
    if (isInviteUrl(url)) return { url, host, kind: 'davet' };
    if (blockAllLinks) return { url, host, kind: 'link' };
  }
  return null;
}

/** Yasakli kelime var mi? (TR kucuk harf duyarli) */
export function containsBadWord(content, words = []) {
  if (!Array.isArray(words) || words.length === 0) return null;
  const text = String(content ?? '').toLocaleLowerCase('tr');
  for (const word of words) {
    const normalized = String(word ?? '').trim().toLocaleLowerCase('tr');
    if (normalized.length < 3) continue;
    if (text.includes(normalized)) return word;
  }
  return null;
}

/**
 * Spam takibi (kullanici basina): hiz + tekrar eden mesaj.
 * @param {{windowMs?: number, maxMessages?: number, duplicateMax?: number}} [opts]
 * @returns {{check: (userId: string, content: string) => {spam: boolean, reason: string|null, count: number}}}
 */
export function createSpamTracker({ windowMs = 5000, maxMessages = 5, duplicateMax = 3 } = {}) {
  const byUser = new Map(); // userId -> {times: number[], contents: Map<string, number>}

  const prune = (entry, now) => {
    entry.times = entry.times.filter((t) => now - t < windowMs);
    // icerik sayaclari tek pencere icinde anlamli: yaslaninca sifirla
    if (entry.times.length === 0) entry.contents.clear();
  };

  return {
    check(userId, content) {
      const now = Date.now();
      const key = String(userId);
      let entry = byUser.get(key);
      if (!entry) {
        entry = { times: [], contents: new Map() };
        byUser.set(key, entry);
      }
      prune(entry, now);

      entry.times.push(now);
      const normalized = String(content ?? '').trim().slice(0, 200);
      if (normalized) {
        entry.contents.set(normalized, (entry.contents.get(normalized) ?? 0) + 1);
      }

      if (entry.times.length > maxMessages) {
        return { spam: true, reason: 'hiz', count: entry.times.length };
      }
      const duplicateCount = normalized ? entry.contents.get(normalized) ?? 0 : 0;
      if (duplicateCount >= duplicateMax) {
        return { spam: true, reason: 'tekrar', count: duplicateCount };
      }
      return { spam: false, reason: null, count: entry.times.length };
    },
  };
}

export function clearSpamTracker(tracker) {
  // tracker closure'i; disaridan temizlik gerekmiyor (test icin no-op)
  return tracker;
}
