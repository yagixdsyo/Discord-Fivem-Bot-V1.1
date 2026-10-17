/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { setErrorNotifier } from '../../core/errorHandler.js';
import { getLogger } from '../../core/logger.js';
import { error as errorTemplate } from '../../ui/templates/index.js';

let logClient = null;
let cached = { id: null, channel: null };

/** Bootstrap tarafindan cagrilir (ilk hazir bot). */
export function setOwnerLogClient(client) {
  logClient = client;
  cached = { id: null, channel: null };
}

export function getOwnerLogClient() {
  return logClient;
}

export function ownerLogConfigured(config) {
  return Boolean(config?.ownerLog?.channelId);
}

async function resolveChannel(config) {
  const id = config?.ownerLog?.channelId;
  if (!id || !logClient) return null;
  if (cached.id === id && cached.channel) return cached.channel;
  try {
    const channel = await logClient.channels.fetch(id);
    cached = { id, channel };
    return channel;
  } catch {
    return null;
  }
}

/**
 * Owner log kanalina V2 karti gonderir.
 * @returns {Promise<boolean>} gonderildi mi?
 */
export async function sendOwnerLog(payload, config) {
  try {
    const channel = await resolveChannel(config);
    if (!channel?.isTextBased?.()) return false;
    await channel.send(payload);
    return true;
  } catch (err) {
    getLogger().warn({ err: err?.message }, 'Owner log gonderilemedi');
    return false;
  }
}

/** Bir kullaniciya DM gonderir (basarisizsa false). */
export async function notifyUserDm(config, userId, payload) {
  if (!logClient || !userId) return false;
  try {
    const user = await logClient.users.fetch(userId);
    await user.send(payload);
    return true;
  } catch {
    return false;
  }
}

/** Sunucu sistem kanalina mesaj dener (DM kapaliysa yedek yol). */
export async function notifyGuildSystemChannel(guild, payload) {
  try {
    const channel = guild?.systemChannel;
    if (!channel?.isTextBased?.()) return false;
    await channel.send(payload);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Hata bildirimcisi
// ---------------------------------------------------------------------------

let sentAt = [];
const MAX_PER_MINUTE = 10;

/** reportError -> owner log kanali. Bootstrap bir kez cagirir. */
export function attachErrorNotifier(config) {
  setErrorNotifier(async (entry) => {
    const now = Date.now();
    sentAt = sentAt.filter((t) => now - t < 60_000);
    if (sentAt.length >= MAX_PER_MINUTE) return;
    sentAt.push(now);

    const stack = String(entry.stack ?? '').split('\n').slice(0, 8).join('\n').slice(0, 900);
    const lines = [
      `**Kaynak:** ${entry.context?.source ?? '-'}`,
      `**Sunucu:** ${entry.context?.guildId ?? '-'}`,
      `**Kullanıcı:** ${entry.context?.userId ?? '-'}`,
      `**Komut:** ${entry.context?.command ?? '-'}`,
      `**Mesaj:** ${entry.message}`,
    ];
    if (stack) lines.push('```\n' + stack + '\n```');

    await sendOwnerLog(errorTemplate(`Hata: ${entry.code}`, lines), config);
  });
}
