/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { deleteDocs, findDocs, findOneDoc, insertDoc } from './store.js';

const COL = 'reaction_roles';
const COOLDOWN_MS = 1500;

const lastAction = new Map(); // `${guildId}:${userId}` -> ms

export function clearReactionCooldown() {
  lastAction.clear();
}

/** Spam/tekrar kontrolu: true -> islem yapilabilir. */
export function canReact(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const last = lastAction.get(key) ?? 0;
  if (now - last < COOLDOWN_MS) return false;
  lastAction.set(key, now);
  return true;
}

/** Tepkiyi karsilastirilabilir anahtara cevirir: ozel emoji id'si veya unicode. */
export function emojiKeyOf(emoji) {
  if (emoji?.id) return `id:${emoji.id}`;
  return `uni:${emoji?.name ?? ''}`;
}

export async function addReactionRole({ guildId, channelId, messageId, emojiKey, roleId, mode = 'rol', label = null }) {
  const existing = await findOneDoc(COL, { guild_id: guildId, message_id: messageId, emoji_key: emojiKey });
  if (existing) return { ok: false, error: 'zaten_var' };

  const doc = {
    guild_id: guildId,
    channel_id: channelId,
    message_id: messageId,
    emoji_key: emojiKey,
    role_id: roleId,
    mode,
    label,
    active: true,
  };
  await insertDoc(COL, doc);
  return { ok: true, doc };
}

export async function removeReactionRole(guildId, { messageId, emojiKey }) {
  const removed = await deleteDocs(COL, { guild_id: guildId, message_id: messageId, emoji_key: emojiKey });
  return removed > 0;
}

export async function listReactionRoles(guildId, { messageId = null, limit = 50 } = {}) {
  const filter = { guild_id: guildId };
  if (messageId) filter.message_id = messageId;
  return findDocs(COL, filter, { sort: { created_at: -1 }, limit });
}

export async function findReactionRole(guildId, messageId, emojiKey) {
  return findOneDoc(COL, { guild_id: guildId, message_id: messageId, emoji_key: emojiKey, active: true });
}
