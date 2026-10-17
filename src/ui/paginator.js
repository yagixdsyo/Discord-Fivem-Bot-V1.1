/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { row, button } from './v2.js';
import { emojiObj } from './emoji.js';

export const PAGE_ID_PREFIX = 'ui:pg';

/** Sayfayi kirpar: {page, totalPages, pageItems, pageSize}. */
export function slicePage(items, page = 0, pageSize = 8) {
  const safeSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / safeSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * safeSize;
  return {
    page: safePage,
    totalPages,
    pageSize: safeSize,
    pageItems: items.slice(start, start + safeSize),
    totalItems: items.length,
  };
}

export function buildPageCustomId(namespace, page, ownerId = 'yok', role = 'p') {
  return `${PAGE_ID_PREFIX}:${role}:${namespace}:${ownerId}:${page}`;
}

/**
 * Sayfa customId'sini cozer; tanimli degilse null.
 * - Yeni: 'ui:pg:<rol>:<ns>:<owner>:<sayfa>'  -> { namespace, ownerId, page, role }
 * - Eski: 'ui:pg:<ns>:<owner>:<sayfa>'        -> { namespace, ownerId, page }
 */
export function parsePageCustomId(customId) {
  if (typeof customId !== 'string') return null;
  const parts = customId.split(':');
  if (parts[0] !== 'ui' || parts[1] !== 'pg') return null;

  if (parts.length === 6) {
    const page = Number.parseInt(parts[5], 10);
    if (Number.isNaN(page)) return null;
    return { namespace: parts[3], ownerId: parts[4], page, role: parts[2] };
  }

  // Eski bicim (olasi eski mesajlar icin geriye uyum)
  if (parts.length === 5) {
    const page = Number.parseInt(parts[4], 10);
    if (Number.isNaN(page)) return null;
    return { namespace: parts[2], ownerId: parts[3], page };
  }

  return null;
}

/**
 * Sayfa buton satiri.
 * @param {{namespace: string, page: number, totalPages: number, ownerId?: string, disabled?: boolean}} opts
 */
export function pageButtons({ namespace, page, totalPages, ownerId = 'yok', disabled = false }) {
  const atFirst = page <= 0;
  const atLast = page >= totalPages - 1;

  // Emoji eksikse buton etiketsiz kalip gonderim hatasi vermesin: yedek etiket.
  const fallback = (key, label) => (emojiObj(key) ? undefined : label);

  const first = button({
    id: buildPageCustomId(namespace, 0, ownerId, 'f'),
    emojiKey: 'OK_ILK',
    label: fallback('OK_ILK', '«'),
    style: 'secondary',
    disabled: disabled || atFirst,
  });
  const prev = button({
    id: buildPageCustomId(namespace, Math.max(0, page - 1), ownerId, 'p'),
    emojiKey: 'OK_SOL',
    label: fallback('OK_SOL', '‹'),
    style: 'secondary',
    disabled: disabled || atFirst,
  });
  const indicator = button({
    id: `ui:pg:gostergesi:${ownerId}`,
    label: `${page + 1}/${totalPages}`,
    style: 'primary',
    disabled: true,
  });
  const next = button({
    id: buildPageCustomId(namespace, Math.min(totalPages - 1, page + 1), ownerId, 'n'),
    emojiKey: 'OK_SAG',
    label: fallback('OK_SAG', '›'),
    style: 'secondary',
    disabled: disabled || atLast,
  });
  const last = button({
    id: buildPageCustomId(namespace, totalPages - 1, ownerId, 'l'),
    emojiKey: 'OK_SON',
    label: fallback('OK_SON', '»'),
    style: 'secondary',
    disabled: disabled || atLast,
  });

  return row([first, prev, indicator, next, last]);
}
