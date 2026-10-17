/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from './base.js';

/** Basari karti. */
export function success(title, lines = [], opts = {}) {
  return card({ emojiKey: 'BASARI', accent: 'success', title, lines, ...opts });
}
