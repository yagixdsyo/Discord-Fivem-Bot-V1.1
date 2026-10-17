/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  accentNumber,
  CARD_MUTED as MUTED,
  CARD_ROW as ROW,
  clipText,
  drawAvatar,
  drawCardHeader,
  drawChip,
  loadImageSafe,
  paintCardBase,
  roundRect,
  toHex,
  withCanvas,
} from './base.js';

const ROAD_BG = '#20242c';
const DASH = '#f7c948';

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function circle(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Otoyol seridini cizer. */
function drawRoad(ctx, { x, y, width, height, ratio, accentHex }) {
  const r = height / 2;

  ctx.fillStyle = ROAD_BG;
  roundRect(ctx, x, y, width, height, r);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, width, height, r);
  ctx.stroke();

  // Ilerleme dolgusu
  const innerX = x + 6;
  const innerW = width - 12;
  const innerH = height - 12;
  const fillW = Math.max(innerH, innerW * clamp01(ratio));
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = accentHex;
  roundRect(ctx, innerX, y + 6, fillW, innerH, innerH / 2);
  ctx.fill();
  ctx.restore();

  // Kesikli serit
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = DASH;
  for (let dx = innerX + 22; dx < x + width - 30; dx += 36) {
    roundRect(ctx, dx, y + height / 2 - 2, 18, 4, 2);
    ctx.fill();
  }
  ctx.restore();

  // Baslangic cizgisi
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x + 10, y + 8, 4, height - 16, 2);
  ctx.fill();
  ctx.restore();

  // Finis (damali) cizgisi
  const fw = 14;
  const fh = Math.floor((height - 12) / 4);
  const fx = x + width - 22;
  for (let col = 0; col < 2; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      ctx.fillStyle = (col + row) % 2 === 0 ? '#ffffff' : '#3a4150';
      ctx.fillRect(fx + col * (fw / 2), y + 6 + row * fh, fw / 2, fh);
    }
  }
}

/** Stilize araci cizer (cx: arac merkezi, cy: yol merkezi). */
function drawCar(ctx, { cx, cy, accentHex }) {
  // Far isigi
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#fff8d6';
  roundRect(ctx, cx + 40, cy - 10, 30, 20, 10);
  ctx.fill();
  ctx.restore();

  // Tekerlekler
  circle(ctx, cx - 22, cy + 15, 10, '#0b0d11');
  circle(ctx, cx + 22, cy + 15, 10, '#0b0d11');
  circle(ctx, cx - 22, cy + 15, 4, '#3a4150');
  circle(ctx, cx + 22, cy + 15, 4, '#3a4150');

  // Govde
  ctx.fillStyle = accentHex;
  roundRect(ctx, cx - 42, cy - 10, 84, 24, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, cx - 42, cy - 10, 84, 24, 9);
  ctx.stroke();

  // Kabin + cam
  ctx.fillStyle = toHex(0xffffff);
  ctx.save();
  ctx.globalAlpha = 0.16;
  roundRect(ctx, cx - 24, cy - 30, 44, 22, 8);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#0f1218';
  roundRect(ctx, cx - 19, cy - 26, 34, 14, 5);
  ctx.fill();

  // Farlar / stoplar
  circle(ctx, cx + 40, cy + 2, 4, '#fff9c4');
  circle(ctx, cx - 40, cy + 2, 3.5, '#ff6b6b');
}

/**
 * @param {{
 *   title: string,
 *   subtitle?: string|null,
 *   avatarUrl?: string|null,
 *   rankName?: string|null,
 *   nextName?: string|null,
 *   points?: number|string,
 *   nextPoints?: number|string|null,
 *   ratio?: number,
 *   stats?: Array<{label: string, value: string}>,
 *   footer?: string|null,
 *   accent?: number|null,
 * }} opts
 */
export async function renderStaffPng({
  title,
  subtitle = null,
  avatarUrl = null,
  rankName = null,
  nextName = null,
  points = 0,
  nextPoints = null,
  ratio = 0,
  stats = [],
  footer = null,
  accent = null,
}) {
  const avatar = await loadImageSafe(avatarUrl);
  const chips = (stats ?? []).slice(0, 4);
  const W = 920;
  const headerH = subtitle ? 132 : 108;
  const chipsH = chips.length ? 90 : 0;
  const labelH = 40;
  const roadH = 62;
  const footerH = footer ? 44 : 0;
  const height = headerH + chipsH + labelH + roadH + 34 + footerH + 22;

  return withCanvas(W, height, (ctx, meta) => {
    const { width, family } = meta;
    const accentColor = accentNumber(meta, accent);
    const accentHex = toHex(accentColor);

    paintCardBase(ctx, width, height, accentColor);
    drawCardHeader(ctx, width, family, { title, subtitle });

    if (avatar) drawAvatar(ctx, avatar, width - 80, 76, 46, { ringColor: accentColor });

    let y = headerH;

    if (chips.length) {
      const gap = 14;
      const chipW = Math.floor((width - 72 - gap * (chips.length - 1)) / chips.length);
      chips.forEach((chip, index) => {
        drawChip(ctx, 36 + index * (chipW + gap), y, chipW, 76, {
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

    // Rutbe satiri
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 30px ${family}`;
    ctx.fillText(clipText(ctx, rankName ?? '-', width - 260), 40, y + 18);

    if (nextName) {
      ctx.textAlign = 'right';
      ctx.fillStyle = MUTED;
      ctx.font = `600 21px ${family}`;
      ctx.fillText(clipText(ctx, nextName, 340), width - 40, y + 20);
      ctx.textAlign = 'left';
    }

    // Otoyol + arac
    const roadX = 40;
    const roadW = width - 80;
    const roadY = y + labelH;
    drawRoad(ctx, { x: roadX, y: roadY, width: roadW, height: roadH, ratio, accentHex });

    const travel = roadW - 150;
    const carCx = roadX + 62 + travel * clamp01(ratio);
    drawCar(ctx, { cx: carCx, cy: roadY + roadH / 2 - 8, accentHex });

    // Alt etiketler
    ctx.textBaseline = 'middle';
    ctx.fillStyle = MUTED;
    ctx.font = `600 20px ${family}`;
    ctx.textAlign = 'left';
    ctx.fillText(clipText(ctx, String(points), 220), roadX + 2, roadY + roadH + 22);
    if (nextPoints !== null && nextPoints !== undefined) {
      ctx.textAlign = 'right';
      ctx.fillText(clipText(ctx, String(nextPoints), 220), width - 42, roadY + roadH + 22);
      ctx.textAlign = 'left';
    }

    if (footer) {
      ctx.fillStyle = MUTED;
      ctx.font = `500 19px ${family}`;
      ctx.fillText(clipText(ctx, footer, width - 80), 40, height - 26);
    }
  });
}
