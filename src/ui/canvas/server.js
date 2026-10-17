/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  accentNumber,
  CARD_MUTED,
  CARD_ROW,
  clipText,
  drawCardHeader,
  drawChip,
  paintCardBase,
  roundRect,
  toHex,
  toRgba,
  withCanvas,
} from './base.js';

/**
 * @param {{
 *   title: string,
 *   subtitle?: string|null,
 *   statusText?: string|null,
 *   statusColor?: number|null,
 *   online?: {current: number, max: number}|null,
 *   playersLabel?: string|null,
 *   chips?: Array<{label: string, value: string}>,
 *   accent?: number|null,
 * }} opts
 */
export async function renderServerCardPng({
  title,
  subtitle = null,
  statusText = null,
  statusColor = null,
  online = null,
  playersLabel = null,
  chips = [],
  accent = null,
}) {
  const hasPlayers = Boolean(online) && Number.isFinite(online.current);
  const height = hasPlayers ? 336 : 264;

  return withCanvas(880, height, (ctx, meta) => {
    const { width, family } = meta;
    const accentColor = accentNumber(meta, accent);
    const status = typeof statusColor === 'number' ? statusColor : accentColor;

    paintCardBase(ctx, width, height, accentColor);
    drawCardHeader(ctx, width, family, { title, subtitle });

    if (statusText) {
      const pillY = 128;
      ctx.font = `700 24px ${family}`;
      const pillW = Math.max(210, ctx.measureText(statusText).width + 96);

      ctx.fillStyle = toRgba(status, 0.16);
      roundRect(ctx, 36, pillY, pillW, 54, 27);
      ctx.fill();

      ctx.fillStyle = toHex(status);
      ctx.beginPath();
      ctx.arc(36 + 34, pillY + 27, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(clipText(ctx, statusText, pillW - 96), 36 + 58, pillY + 28);
    }

    if (hasPlayers) {
      const ratio = Math.max(0, Math.min(1, (online.current ?? 0) / Math.max(1, online.max ?? 1)));
      const countText = `${online.current} / ${online.max ?? '?'}`;

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const label = playersLabel ? `${playersLabel} • %${Math.round(ratio * 100)}` : `%${Math.round(ratio * 100)}`;
      ctx.fillStyle = CARD_MUTED;
      ctx.font = `500 20px ${family}`;
      ctx.fillText(clipText(ctx, label, 320), width - 36, 138);

      ctx.fillStyle = '#ffffff';
      ctx.font = `800 46px ${family}`;
      ctx.fillText(clipText(ctx, countText, 340), width - 36, 178);
      ctx.textAlign = 'left';

      const trackX = 36;
      const trackY = 214;
      const trackW = width - 72;
      const trackH = 14;
      const radius = trackH / 2;

      ctx.fillStyle = CARD_ROW;
      roundRect(ctx, trackX, trackY, trackW, trackH, radius);
      ctx.fill();

      if (ratio > 0) {
        ctx.fillStyle = toHex(accentColor);
        roundRect(ctx, trackX, trackY, Math.max(trackH, trackW * ratio), trackH, radius);
        ctx.fill();
      }
    }

    const list = chips.slice(0, 3);
    if (list.length > 0) {
      const gap = 14;
      const chipW = Math.floor((width - 72 - (list.length - 1) * gap) / list.length);
      const chipY = hasPlayers ? 246 : 182;
      list.forEach((chip, index) => {
        drawChip(ctx, 36 + index * (chipW + gap), chipY, chipW, 64, {
          label: chip.label,
          value: chip.value,
          valueColor: chip.valueColor ?? '#ffffff',
          bg: CARD_ROW,
          labelColor: CARD_MUTED,
          family,
        });
      });
    }
  });
}
