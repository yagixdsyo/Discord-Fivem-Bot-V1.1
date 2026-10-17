/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from './base.js';

/**
 * Anahtar-deger bilgi karti.
 * rows: [[etiket, deger], ...] -> '**etiket:** deger'
 */
export function kv({ title, rows = [], footer, buttons = [], accent = 'info', emojiKey, subtitle, ephemeral }) {
  const lines = rows
    .filter((r) => r && r.length >= 2 && r[1] !== undefined && r[1] !== null)
    .map(([label, value]) => `**${label}:** ${value}`);

  return card({ emojiKey, title, subtitle, lines, buttons, accent, footer, ephemeral });
}
