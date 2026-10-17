/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from './base.js';
import { slicePage, pageButtons } from '../paginator.js';
import { row } from '../v2.js';

/**
 * Sayfali liste karti.
 *
 * Kullanim:
 *   const { payload, page, totalPages } = list({ title, items, page, pageSize, renderItem, ... });
 * Sayfa butonlarinin customId'leri 'ui:pg:<rol>:<namespace>:<ownerId>:<sayfa>' bicimindedir;
 * cagiran taraf collector kurup parsePageCustomId ile sayfa degisimini yonetir.
 *
 * @returns {{ payload: object, page: number, totalPages: number, pageItems: unknown[] }}
 */
export function list({
  title,
  items = [],
  page = 0,
  pageSize = 8,
  renderItem,
  footer,
  buttons = [],
  emptyText = 'Kayit bulunamadi.',
  namespace = 'liste',
  ownerId = 'yok',
  accent = 'primary',
  emojiKey,
  showPageButtons = true,
  extraRows = [],
  lines: providedLines,
}) {
  const hasProvidedLines = Array.isArray(providedLines);
  const sliced = hasProvidedLines
    ? { page: 0, totalPages: 1, pageItems: [] }
    : slicePage(items, page, pageSize);

  const lines = hasProvidedLines
    ? providedLines.length > 0
      ? providedLines
      : [emptyText]
    : sliced.pageItems.length === 0
      ? [emptyText]
      : sliced.pageItems.map((item, i) => renderItem(item, sliced.page * sliced.pageSize + i));

  const rows = [];
  if (showPageButtons && sliced.totalPages > 1) {
    rows.push(pageButtons({ namespace, page: sliced.page, totalPages: sliced.totalPages, ownerId }));
  }
  for (const extra of extraRows) rows.push(extra);
  for (const btn of buttons) rows.push(Array.isArray(btn) ? row(btn) : btn);

  const payload = card({
    emojiKey,
    title,
    lines,
    buttons: rows,
    accent,
    footer,
  });

  // Hem `{ payload, page, totalPages, pageItems }` (collector akislari) hem de
  // dogrudan `ctx.reply(list(...))` kullanimini desteklemek icin payload alanlari
  // ust seviyeye de yayilir.
  return { ...payload, payload, page: sliced.page, totalPages: sliced.totalPages, pageItems: sliced.pageItems };
}
