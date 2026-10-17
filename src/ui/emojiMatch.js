/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export function matchEmojis({ keys = [], available = [] }) {
  const byName = new Map();
  for (const entry of available) {
    if (!entry?.id || !entry?.name) continue;
    const name = String(entry.name).toLowerCase();
    if (!byName.has(name)) byName.set(name, entry);
  }

  const matched = [];
  const unmatched = [];
  for (const key of keys) {
    const hit = byName.get(String(key).toLowerCase());
    if (hit) {
      matched.push({ key, id: String(hit.id), animated: Boolean(hit.animated) });
    } else {
      unmatched.push(key);
    }
  }
  return { matched, unmatched };
}
