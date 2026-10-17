/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from './base.js';

/** Yukleniyor karti (islem sonrasi edit ile degistirilir). */
export function loading(title, lines = [], opts = {}) {
  return card({ emojiKey: 'YUKLENIYOR', accent: 'primary', title, lines, ...opts });
}
