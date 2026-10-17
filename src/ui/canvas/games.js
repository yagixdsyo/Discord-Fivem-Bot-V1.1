/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  accentNumber,
  CARD_MUTED,
  CARD_ROW,
  clipText,
  drawChip,
  drawCardHeader,
  paintCardBase,
  roundRect,
  toHex,
  toRgba,
  withCanvas,
} from './base.js';
import { getColor } from '../colors.js';

const FACE_BG = '#eef1f7';
const FACE_FG = '#14161c';
const REEL_BORDER = '#2a2f3a';

/** 1-6 arasi zar yuzu icin nokta konumlari (0-1 arasi oran). */
const PIPS = Object.freeze({
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.5], [0.72, 0.5], [0.28, 0.72], [0.72, 0.72]],
});

/** Tek zar cizer: 6 yuzlu zar noktali, digerleri sayili; en yuksek deger accent halkali. */
function drawDie(ctx, x, y, size, value, sides, { family, accentColor }) {
  ctx.save();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  roundRect(ctx, x + 4, y + 7, size, size, size * 0.2);
  ctx.fill();

  ctx.fillStyle = FACE_BG;
  roundRect(ctx, x, y, size, size, size * 0.2);
  ctx.fill();

  if (sides === 6) {
    const pipR = size * 0.085;
    ctx.fillStyle = FACE_FG;
    for (const [px, py] of PIPS[value] ?? PIPS[6]) {
      ctx.beginPath();
      ctx.arc(x + size * px, y + size * py, pipR, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = FACE_FG;
    ctx.font = `800 ${Math.round(size * 0.44)}px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x + size / 2, y + size / 2 + 2);
    ctx.textAlign = 'left';
  }

  if (value === sides) {
    ctx.strokeStyle = toHex(accentColor);
    ctx.lineWidth = 6;
    roundRect(ctx, x - 3, y - 3, size + 6, size + 6, size * 0.22);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Zar sonuc karti (PNG) veya null.
 * @param {{title: string, subtitle?: string|null, rolls: number[], sides?: number, totalLabel?: string|null, accent?: number|null}} opts
 */
export async function renderDicePng({ title, subtitle = null, rolls = [], sides = 6, totalLabel = null, accent = null }) {
  return withCanvas(880, 348, (ctx, meta) => {
    const { width, family } = meta;
    const accentColor = accentNumber(meta, accent);

    paintCardBase(ctx, width, 348, accentColor);
    drawCardHeader(ctx, width, family, { title, subtitle });

    const n = Math.max(1, rolls.length);
    const gap = 22;
    const size = Math.min(132, Math.floor((width - 96 - (n - 1) * gap) / n));
    const rowW = n * size + (n - 1) * gap;
    const rowAreaTop = 122;
    const rowAreaH = 148;
    const y = rowAreaTop + Math.round((rowAreaH - size) / 2);

    let x = Math.round((width - rowW) / 2);
    for (const value of rolls) {
      drawDie(ctx, x, y, size, value, sides, { family, accentColor });
      x += size + gap;
    }

    if (totalLabel) {
      ctx.font = `700 24px ${family}`;
      const chipW = Math.max(240, ctx.measureText(totalLabel).width + 96);
      drawChip(ctx, Math.round((width - chipW) / 2), 276, chipW, 54, {
        label: null,
        value: totalLabel,
        valueColor: toHex(accentColor),
        bg: CARD_ROW,
        labelColor: CARD_MUTED,
        family,
      });
    }
  });
}

/**
 * Yazi-tura sonuc karti (PNG) veya null.
 * @param {{title: string, subtitle?: string|null, resultText: string, chipLabel?: string|null, accent?: number|null}} opts
 */
export async function renderCoinPng({ title, subtitle = null, resultText = '', chipLabel = null, accent = null }) {
  return withCanvas(880, 368, (ctx, meta) => {
    const { width, family } = meta;
    const accentColor = accentNumber(meta, accent);

    paintCardBase(ctx, width, 368, accentColor);
    drawCardHeader(ctx, width, family, { title, subtitle });

    const cx = width / 2;
    const cy = 196;
    const r = 84;

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const coinGradient = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    coinGradient.addColorStop(0, '#232936');
    coinGradient.addColorStop(1, '#14161c');
    ctx.fillStyle = coinGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = toHex(accentColor);
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    try {
      ctx.setLineDash([5, 11]);
    } catch {
      /* desteklenmiyorsa duz cizgi */
    }
    ctx.strokeStyle = toRgba(accentColor, 0.45);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 46px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clipText(ctx, resultText, r * 2 - 56), cx, cy + 2);
    ctx.textAlign = 'left';

    if (chipLabel) {
      ctx.font = `700 24px ${family}`;
      const text = `${chipLabel}: ${resultText}`;
      const chipW = Math.max(240, ctx.measureText(text).width + 88);
      drawChip(ctx, Math.round((width - chipW) / 2), 296, chipW, 54, {
        label: null,
        value: text,
        valueColor: toHex(accentColor),
        bg: CARD_ROW,
        labelColor: CARD_MUTED,
        family,
      });
    }
  });
}

/**
 * Slot makinesi sonuc karti (PNG) veya null.
 * @param {{
 *   title: string,
 *   subtitle?: string|null,
 *   reels: Array<{code: string, label: string}>,
 *   win?: boolean,
 *   statusText?: string|null,
 *   accent?: number|null,
 * }} opts
 */
export async function renderSlotPng({ title, subtitle = null, reels = [], win = false, statusText = null, accent = null }) {
  return withCanvas(880, 428, (ctx, meta) => {
    const { width, family } = meta;
    const accentColor = accentNumber(meta, accent);
    const winColor = getColor('success');

    paintCardBase(ctx, width, 428, accentColor);
    drawCardHeader(ctx, width, family, { title, subtitle });

    const size = 200;
    const gap = 30;
    const totalW = reels.length * size + Math.max(0, reels.length - 1) * gap;
    const y = 128;
    let x = Math.round((width - totalW) / 2);

    for (const reel of reels) {
      ctx.save();
      if (win) {
        ctx.shadowColor = toRgba(winColor, 0.55);
        ctx.shadowBlur = 26;
      }
      ctx.fillStyle = CARD_ROW;
      roundRect(ctx, x, y, size, size, 24);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = win ? toHex(winColor) : REEL_BORDER;
      ctx.lineWidth = win ? 6 : 3;
      roundRect(ctx, x, y, size, size, 24);
      ctx.stroke();

      ctx.fillStyle = toHex(win ? winColor : accentColor);
      ctx.font = `800 54px ${family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(clipText(ctx, reel.code ?? '', size - 40), x + size / 2, y + 84);

      ctx.fillStyle = CARD_MUTED;
      ctx.font = `500 21px ${family}`;
      ctx.fillText(clipText(ctx, reel.label ?? '', size - 36), x + size / 2, y + 150);
      ctx.textAlign = 'left';

      x += size + gap;
    }

    if (statusText) {
      ctx.font = `700 25px ${family}`;
      const pillW = Math.max(320, ctx.measureText(statusText).width + 72);
      const pillX = Math.round((width - pillW) / 2);
      const pillY = 352;

      ctx.fillStyle = win ? toRgba(winColor, 0.16) : CARD_ROW;
      roundRect(ctx, pillX, pillY, pillW, 56, 28);
      ctx.fill();

      ctx.fillStyle = win ? toHex(winColor) : '#c7ccd6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(clipText(ctx, statusText, pillW - 48), width / 2, pillY + 29);
      ctx.textAlign = 'left';
    }
  });
}
