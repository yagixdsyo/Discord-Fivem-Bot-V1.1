/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { emoji } from '../../../ui/emoji.js';

/**
 * @param {number} current hedefe dogru mevcut deger
 * @param {number} target hedef deger
 * @param {{segments?: number}} opts toplam parca sayisi (3-14)
 */
export function progressBar(current, target, { segments = 10 } = {}) {
  const safeTarget = Math.max(1, Number(target) || 1);
  const ratio = Math.max(0, Math.min(1, (Number(current) || 0) / safeTarget));
  const segs = Math.max(3, Math.min(14, Math.floor(segments)));
  const filled = Math.round(ratio * segs);

  const start = filled > 0 ? emoji('BAR_BAS_DOLU') : emoji('BAR_BAS_BOS');
  const end = filled >= segs ? emoji('BAR_SON_DOLU') : emoji('BAR_SON_BOS');
  let middle = '';
  for (let i = 1; i < segs - 1; i += 1) {
    middle += i < filled ? emoji('BAR_ORTA_DOLU') : emoji('BAR_ORTA_BOS');
  }
  return `${start}${middle}${end}`;
}
