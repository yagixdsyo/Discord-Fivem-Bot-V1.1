/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from './base.js';

/** Uyari karti. */
export function warn(title, lines = [], opts = {}) {
  return card({ emojiKey: 'UYARI', accent: 'warn', title, lines, ...opts });
}
