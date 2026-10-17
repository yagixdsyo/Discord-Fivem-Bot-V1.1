/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from './base.js';

const BAR_LENGTH = 20;

/** Ilerleme cubugu: '████░░░░░░░░░░░░░░░░ 20%' (emoji degil, blok karakter). */
export function bar(done, total, length = BAR_LENGTH) {
  const safeTotal = Math.max(1, total);
  const ratio = Math.min(1, Math.max(0, done / safeTotal));
  const filled = Math.round(ratio * length);
  return `\`${'█'.repeat(filled)}${'░'.repeat(length - filled)}\` ${Math.round(ratio * 100)}%`;
}

/**
 * Ilerleme karti (toplu islemler, kurulum adimlari).
 */
export function progress({ title, done, total, statusText, footer, buttons = [], accent = 'primary', emojiKey = 'YUKLENIYOR' }) {
  const lines = [`${bar(done, total)}  (${done}/${total})`];
  if (statusText) lines.push(statusText);
  return card({ emojiKey, title, lines, buttons, accent, footer });
}
