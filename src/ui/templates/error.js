/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from './base.js';

/**
 * Hata karti. Kullaniciya teknik detay gosterilmez:
 * baslik + aciklama + hata kodu (`-# Kod: \`ERR-XXXXXX\``) gosterilir.
 * @param {string} title
 * @param {string[]} lines
 * @param {{ code?: string, codeLine?: string, ephemeral?: boolean }} [opts]
 */
export function error(title, lines = [], opts = {}) {
  const { code, codeLine, ...rest } = opts;
  const subtitle = codeLine ?? (code ? `Kod: \`${code}\`` : undefined);
  return card({ emojiKey: 'HATA', accent: 'error', title, lines, subtitle, ...rest });
}
