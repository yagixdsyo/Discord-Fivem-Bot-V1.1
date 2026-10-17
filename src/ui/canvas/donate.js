/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  accentNumber,
  CARD_MUTED as MUTED,
  CARD_ROW as ROW,
  clipText,
  drawCardHeader,
  drawChip,
  paintCardBase,
  roundRect,
  toHex,
  toRgba,
  withCanvas,
} from './base.js';

const ROW_ALT = '#171a21';

/**
 * @param {{
 *   title: string,
 *   subtitle?: string|null,
 *   page?: { index: number, total: number }|null,
 *   stats?: Array<{label: string, value: string}>,
 *   rows?: Array<{title: string, subtitle?: string|null, value?: string|null}>,
 *   footer?: string|null,
 *   accent?: number|null,
 * }} opts
 */
export function renderDonatePng({ title, subtitle = null, page = null, stats = [], rows = [], footer = null, accent = null }) {
  const chips = (stats ?? []).slice(0, 3);
  const list = (rows ?? []).slice(0, 8);
  const headerH = subtitle ? 128 : 104;
  const chipsH = chips.length ? 102 : 0;
  const rowH = 62;
  const footerH = footer ? 48 : 0;
  const height = headerH + chipsH + Math.max(1, list.length) * rowH + 8 + footerH + 18;

  return withCanvas(880, height, (ctx, meta) => {
    const { width, family } = meta;
    const accentColor = accentNumber(meta, accent);
    const accentHex = toHex(accentColor);

    paintCardBase(ctx, width, height, accentColor);

    drawCardHeader(ctx, width, family, { title, subtitle });

    if (page) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = toRgba(accentColor, 0.16);
      roundRect(ctx, width - 150, 32, 114, 40, 20);
      ctx.fill();
      ctx.fillStyle = accentHex;
      ctx.font = `700 21px ${family}`;
      ctx.fillText(`${page.index}/${page.total}`, width - 93, 53);
      ctx.textAlign = 'left';
    }

    let y = headerH;

    if (chips.length) {
      const gap = 16;
      const chipW = Math.floor((width - 72 - gap * (chips.length - 1)) / chips.length);
      chips.forEach((chip, index) => {
        drawChip(ctx, 36 + index * (chipW + gap), y, chipW, 84, {
          label: chip.label,
          value: chip.value,
          valueColor: '#ffffff',
          bg: ROW,
          labelColor: MUTED,
          family,
        });
      });
      y += chipsH;
    }

    if (list.length === 0) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = MUTED;
      ctx.font = `500 24px ${family}`;
      ctx.fillText(clipText(ctx, footer ?? '-', width - 120), width / 2, y + rowH / 2);
      ctx.textAlign = 'left';
      y += rowH;
    }

    list.forEach((item, index) => {
      const rowY = y + index * rowH;
      ctx.fillStyle = index % 2 === 0 ? ROW : ROW_ALT;
      roundRect(ctx, 24, rowY, width - 48, 54, 14);
      ctx.fill();

      ctx.fillStyle = accentHex;
      roundRect(ctx, 36, rowY + 12, 6, 30, 3);
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 22px ${family}`;
      const titleY = item.subtitle ? rowY + 19 : rowY + 27;
      const textMax = item.value ? 470 : 620;
      ctx.fillText(clipText(ctx, item.title, textMax), 58, titleY);

      if (item.subtitle) {
        ctx.fillStyle = MUTED;
        ctx.font = `500 17px ${family}`;
        ctx.fillText(clipText(ctx, item.subtitle, textMax), 58, rowY + 40);
      }

      if (item.value) {
        ctx.textAlign = 'right';
        ctx.fillStyle = accentHex;
        ctx.font = `800 23px ${family}`;
        ctx.fillText(clipText(ctx, item.value, 220), width - 44, rowY + 27);
        ctx.textAlign = 'left';
      }
    });

    if (footer) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = MUTED;
      ctx.font = `500 19px ${family}`;
      ctx.fillText(clipText(ctx, footer, width - 72), 36, height - 28);
    }
  });
}
