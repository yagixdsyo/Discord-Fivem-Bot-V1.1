/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { renderTranscriptHtml } from '../../logging/lib/transcript.js';

export const MAX_FETCH = 100;
export const BULK_DELETE_MAX_AGE_MS = 14 * 86_400_000;

/**
 * Kanaldan silinecek mesajlari toplar.
 * @returns {Promise<{messages: object[], deletable: object[], skippedPinned: number, skippedOld: number}>}
 */
export async function collectForDelete(channel, count) {
  const limit = Math.min(Math.max(1, Number(count) || 50), MAX_FETCH);
  const fetched = await channel.messages.fetch({ limit });
  const messages = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const deletable = [];
  let skippedPinned = 0;
  let skippedOld = 0;
  for (const message of messages) {
    if (message.pinned) {
      skippedPinned += 1;
      continue;
    }
    if (Date.now() - message.createdTimestamp >= BULK_DELETE_MAX_AGE_MS) {
      skippedOld += 1;
      continue;
    }
    deletable.push(message);
  }
  return { messages, deletable, skippedPinned, skippedOld };
}

/** Mesajlari HTML transcript'e cevirir. */
export function buildTranscriptHtml({ guildName, channelName, messages }) {
  return renderTranscriptHtml({
    guildName,
    channelName,
    messages: messages.map((message) => ({
      authorTag: message.author?.tag ?? message.author?.username ?? '?',
      content: message.content ?? '',
      at: message.createdTimestamp,
      hadAttachments: Boolean(message.attachments?.size),
    })),
  });
}

/** sourceb.in yukleme (opsiyonel: SOURCEBIN_TOKEN tanimliysa). */
export async function uploadTranscript(html, title = 'transcript') {
  const token = process.env.SOURCEBIN_TOKEN;
  if (!token) return null;
  try {
    const response = await fetch('https://sourceb.in/api/bins', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ files: [{ content: html, languageId: 'html', name: title }] }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.key ? `https://sourceb.in/${data.key}` : null;
  } catch {
    return null;
  }
}
