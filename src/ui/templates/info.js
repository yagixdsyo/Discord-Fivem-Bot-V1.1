/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from './base.js';

/** Bilgi karti. */
export function info(title, lines = [], opts = {}) {
  return card({ emojiKey: 'BILGI', accent: 'info', title, lines, ...opts });
}
