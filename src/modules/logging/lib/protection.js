/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from 'discord.js';
import { getCollection, isDbReady } from '../../../db/index.js';
import { getLogger } from '../../../core/logger.js';
import { getGuildConfig } from '../../../core/guildSettings.js';
import { findAuditActor } from './audit.js';

const MEM_CAP = 2000;
const memory = new Map(); // messageId -> doc
let punisher = null;

export function setLogDeletePunisher(fn) {
  punisher = typeof fn === 'function' ? fn : null;
}

function prune() {
  if (memory.size <= MEM_CAP) return;
  const excess = memory.size - MEM_CAP;
  let removed = 0;
  for (const key of memory.keys()) {
    memory.delete(key);
    removed += 1;
    if (removed >= excess) break;
  }
}

/** Gonderilen log mesajinin kopyasini saklar. */
export async function storeSentLog({ guildId, channelId, messageId, items }) {
  if (!messageId || !channelId) return;
  const doc = {
    guild_id: guildId ?? null,
    channel_id: String(channelId),
    message_id: String(messageId),
    keys: items.map((item) => item.key).filter(Boolean),
    entries: items.map((item) => ({ key: item.key, entry: item.entry, at: item.at })),
    at: new Date(),
  };

  memory.set(doc.message_id, doc);
  prune();

  if (isDbReady()) {
    try {
      await getCollection('log_messages').updateOne(
        { message_id: doc.message_id },
        { $set: { ...doc, expireAt: new Date(Date.now() + 30 * 24 * 3600 * 1000) } },
        { upsert: true },
      );
    } catch {
      /* yut */
    }
  }
}

/** Saklanan kopyayi bulur (once bellek, sonra MongoDB). */
export async function findStoredLog(messageId) {
  const hit = memory.get(String(messageId));
  if (hit) return hit;
  if (!isDbReady()) return null;
  try {
    return await getCollection('log_messages').findOne({ message_id: String(messageId) });
  } catch {
    return null;
  }
}

/**
 * Log kanalindaki mesaj silinmesini korur.
 * @param {import('discord.js').Message|import('discord.js').PartialMessage} message
 * @param {{ client: import('discord.js').Client }} deps
 * @returns {Promise<boolean>} koruma devreye girdi mi
 */
export async function handleProtectedDelete(message, { client }) {
  const doc = await findStoredLog(message.id);
  if (!doc) return false;

  const { enqueueLog } = await import('./queue.js');
  const guildId = message.guildId ?? doc.guild_id;

  // 1) Orijinal kayitlari yeniden gonder
  for (const item of doc.entries ?? []) {
    if (!item?.key) continue;
    await enqueueLog({
      channelId: doc.channel_id,
      guildId,
      key: item.key,
      entry: { ...(item.entry ?? {}), title: item.entry?.title },
      at: Date.now(),
    });
  }

  // 2) Silen kisiyi audit log'dan bul
  let deleter = null;
  if (message.guild) {
    deleter = await findAuditActor(message.guild, AuditLogEvent.MessageDelete, client.user.id, {
      channelId: message.channelId,
      important: true,
    });
    if (deleter?.actorId === client.user.id) deleter = null; // kendi temizligimiz
  }

  // 3) Uyari karti
  const { createTranslator } = await import('../../../locales/index.js');
  const t = createTranslator('tr');
  await enqueueLog({
    channelId: doc.channel_id,
    guildId,
    key: doc.keys?.[0] ?? 'log_guard',
    at: Date.now(),
    entry: {
      title: t('log.protect.title'),
      accent: 'warn',
      actor: deleter?.actorId ?? null,
      actorTag: deleter?.actorTag ?? null,
      lines: [
        t('log.protect.restored', { adet: (doc.entries ?? []).length }),
        deleter ? t('log.protect.deleter') : t('log.protect.unknown_deleter'),
      ],
      ids: [['Mesaj', doc.message_id]],
    },
  });

  // 4) Ayarliysa ceza uygula
  if (punisher && deleter?.actorId) {
    try {
      const config = await getGuildConfig(guildId, { fresh: true });
      if (config?.settings?.['logs.protect.punish'] === true) {
        await punisher({
          guildId,
          userId: deleter.actorId,
          channelId: String(message.channelId),
          messageId: String(message.id),
        });
      }
    } catch (err) {
      getLogger().debug({ err: err?.message }, 'Log koruma cezasi uygulanamadi');
    }
  }

  return true;
}
