/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from './base.js';
import { button, row, footerLine } from '../v2.js';

/**
 * Onay karti.
 * Buton customId'leri cagiran tarafindan uretilir; ownerId/kritik id customId'ye gomulur.
 */
export function confirm({
  title,
  description,
  confirmId,
  cancelId,
  confirmLabel = 'Onayla',
  cancelLabel = 'Iptal',
  danger = false,
  footer,
  footerParts,
}) {
  const lines = Array.isArray(description) ? description : description ? [description] : [];
  const rows = [
    row([
      button({
        id: confirmId,
        label: confirmLabel,
        emojiKey: 'ONAY',
        style: danger ? 'danger' : 'success',
      }),
      button({ id: cancelId, label: cancelLabel, emojiKey: 'RED', style: 'secondary' }),
    ]),
  ];

  return card({
    emojiKey: 'BEKLE',
    title,
    lines,
    buttons: rows,
    accent: danger ? 'error' : 'warn',
    footer: footer ?? footerLine(footerParts ?? []),
  });
}
