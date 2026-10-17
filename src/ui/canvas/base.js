/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { getColors } from '../colors.js';

let fontFamily = null;

/** Fontlari (bir kez) hazirlar ve kullanilacak aile adini doner. */
export function ensureFonts() {
  if (fontFamily) return fontFamily;
  fontFamily = 'sans-serif';

  try {
    const dir = path.resolve('assets', 'fonts');
    if (fs.existsSync(dir)) {
      for (const file of fs.readdirSync(dir)) {
        if (/\.(ttf|otf|ttc)$/i.test(file)) {
          try {
            GlobalFonts.registerFromPath(path.join(dir, file));
          } catch {
            /* tek font hatasi yutulur */
          }
        }
      }
    }
  } catch {
    /* assets yoksa sistem fontlari */
  }

  try {
    GlobalFonts.loadSystemFonts();
  } catch {
    /* yut */
  }

  try {
    const families = (GlobalFonts.families ?? []).map((entry) => entry.family);
    const preferred = ['Kateshi', 'Poppins', 'Montserrat', 'Inter', 'Segoe UI', 'Arial', 'DejaVu Sans', 'Noto Sans'];
    fontFamily = preferred.find((name) => families.includes(name)) ?? families[0] ?? 'sans-serif';
  } catch {
    /* yut */
  }
  return fontFamily;
}

/** Yuvarlatilmis dikdortgen yolu (fill/stroke cagiran tarafta). */
export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Metni max genislige sigdirir (tasiyorsa ... ekler). */
export function clipText(ctx, value, maxWidth) {
  const text = String(value ?? '');
  if (maxWidth <= 0 || ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

/**
 * PNG buffer uretir; hata halinde null.
 * @param {number} width
 * @param {number} height
 * @param {(ctx: object, meta: {width: number, height: number, family: string, colors: object}) => void} draw
 * @returns {Buffer|null}
 */
export function withCanvas(width, height, draw) {
  try {
    const family = ensureFonts();
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    draw(ctx, { width, height, family, colors: getColors() });
    return canvas.toBuffer('image/png');
  } catch {
    return null;
  }
}

/** Gorsel yukler; hata halinde null. */
export async function loadImageSafe(source) {
  if (!source) return null;
  try {
    return await loadImage(source);
  } catch {
    return null;
  }
}

/** 24 bit rengi #rrggbb metnine cevirir. */
export function toHex(color) {
  return `#${(Number(color ?? 0) & 0xffffff).toString(16).padStart(6, '0')}`;
}

/** 24 bit rengi rgba(...) metnine cevirir. */
export function toRgba(color, alpha = 1) {
  const value = Number(color ?? 0) & 0xffffff;
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Dogrusal gradyan uretir: stops: [[0, '#..'], [1, '#..']] */
export function gradient(ctx, x0, y0, x1, y1, stops = []) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  return g;
}

/**
 * Avatar cizer: daire kirpma + halka; gorsel yoksa bas harfli yedek daire.
 * @returns {boolean} gorsel cizildi mi
 */
export function drawAvatar(ctx, image, cx, cy, radius, { ringColor = null, ringWidth = 6, fallbackText = '?', fallbackBg = '#262b35', fallbackFg = '#c7ccd6' } = {}) {
  let drawn = false;
  if (image) {
    try {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(image, cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.restore();
      drawn = true;
    } catch {
      drawn = false;
    }
  }
  if (!drawn) {
    ctx.fillStyle = fallbackBg;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    const letter = String(fallbackText ?? '?').trim().charAt(0).toLocaleUpperCase('tr') || '?';
    ctx.fillStyle = fallbackFg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(radius * 0.9)}px sans-serif`;
    ctx.fillText(letter, cx, cy + 2);
    ctx.textAlign = 'left';
  }
  if (ringColor !== null && ringColor !== undefined) {
    ctx.strokeStyle = typeof ringColor === 'string' ? ringColor : toHex(ringColor);
    ctx.lineWidth = ringWidth;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + Math.ceil(ringWidth / 2), 0, Math.PI * 2);
    ctx.stroke();
  }
  return drawn;
}

/**
 * Etiket + deger "cikolata" kutusu cizer (profil kartlari icin).
 * @returns {void}
 */
export function drawChip(ctx, x, y, w, h, { label, value, valueColor = '#ffffff', bg = '#1a1e26', labelColor = '#8b93a1', family = 'sans-serif' } = {}) {
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();

  const padX = 18;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  if (label) {
    ctx.fillStyle = labelColor;
    ctx.font = `600 17px ${family}`;
    ctx.fillText(clipText(ctx, label, w - padX * 2), x + padX, y + Math.round(h * 0.32));
  }
  ctx.fillStyle = valueColor;
  ctx.font = `700 24px ${family}`;
  ctx.fillText(clipText(ctx, value ?? '-', w - padX * 2), x + padX, y + Math.round(h * 0.68));
}

// ---------------------------------------------------------------------------
// Kart zemini yardimcilari (cards.js + games.js ortak)
// ---------------------------------------------------------------------------

/** Kart zemin renkleri (tum gorsel kartlarda ayni palet). */
export const CARD_DARK = '#14161c';
export const CARD_ROW = '#1a1e26';
export const CARD_MUTED = '#9aa0aa';

/** Accent degerini (sayi veya '#hex') 24 bit sayiya cevirir. */
export function accentNumber(meta, accent = null) {
  const value = accent ?? meta.colors.primary;
  return typeof value === 'number' ? value : Number.parseInt(String(value).replace('#', ''), 16);
}

/** Kart zemini: koyu zemin + dekoratif daireler + ust accent seridi. */
export function paintCardBase(ctx, width, height, accentColor) {
  ctx.fillStyle = CARD_DARK;
  roundRect(ctx, 0, 0, width, height, 24);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(width - 90, 40, 140, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width - 10, height - 20, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = accentColor;
  roundRect(ctx, 0, 0, width, 10, 5);
  ctx.fill();
}

/** Kart basligi: buyuk baslik + istege bagli alt baslik (sol ust). */
export function drawCardHeader(ctx, width, family, { title, subtitle = null }) {
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 34px ${family}`;
  ctx.fillText(clipText(ctx, title, width - 72), 36, 54);
  if (subtitle) {
    ctx.fillStyle = CARD_MUTED;
    ctx.font = `500 21px ${family}`;
    ctx.fillText(clipText(ctx, subtitle, width - 72), 36, 92);
  }
}

/** Rozet (rozet) cizer: renkli daire + numara. */
export function drawRankBadge(ctx, cx, cy, rank, { colors = [], family = 'sans-serif' } = {}) {
  const medal = colors[rank - 1] ?? null;
  ctx.beginPath();
  ctx.arc(cx, cy, 21, 0, Math.PI * 2);
  ctx.fillStyle = medal ?? '#262b35';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 21px ${family}`;
  ctx.fillStyle = medal ? '#14161c' : '#c7ccd6';
  ctx.fillText(String(rank), cx, cy + 1);
  ctx.textAlign = 'left';
}
