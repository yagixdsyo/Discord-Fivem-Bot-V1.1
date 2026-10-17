/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  accentNumber,
  CARD_DARK as DARK,
  CARD_MUTED as MUTED,
  CARD_ROW as ROW,
  clipText,
  drawAvatar,
  drawCardHeader,
  drawChip,
  drawRankBadge,
  loadImageSafe,
  paintCardBase,
  roundRect,
  toHex,
  toRgba,
  withCanvas,
} from './base.js';
import { getColor } from '../colors.js';

const ROW_ALT = '#171a21';
const MEDALS = ['#f7c948', '#c7ccd6', '#d08b57'];

// ---------------------------------------------------------------------------
// Uye karti (hos geldin + gule gule)
// ---------------------------------------------------------------------------

async function renderMemberCard({ tag, subtitle = null, metaLine = null, avatarUrl = null, accent = null }) {
  const avatar = await loadImageSafe(avatarUrl);
  return withCanvas(880, 300, (ctx, meta) => {
    const { width, height, family } = meta;
    const accentColor = accentNumber(meta, accent);

    paintCardBase(ctx, width, height, accentColor);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(150, 158, 104, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawAvatar(ctx, avatar, 150, 158, 82, { fallbackText: tag, ringColor: accentColor, ringWidth: 7 });

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 44px ${family}`;
    ctx.fillText(clipText(ctx, tag, 520), 292, 112);

    if (subtitle) {
      ctx.fillStyle = MUTED;
      ctx.font = `500 24px ${family}`;
      ctx.fillText(clipText(ctx, subtitle, 520), 292, 160);
    }

    if (metaLine) {
      ctx.font = `700 22px ${family}`;
      const textWidth = ctx.measureText(metaLine).width;
      const pillW = textWidth + 40;
      ctx.fillStyle = toRgba(accentColor, 0.16);
      roundRect(ctx, 292, 196, pillW, 42, 21);
      ctx.fill();
      ctx.fillStyle = toHex(accentColor);
      ctx.fillText(metaLine, 312, 218);
    }
  });
}

/**
 * Hos geldin karti (PNG) veya null.
 * @param {{tag: string, subtitle?: string|null, metaLine?: string|null, avatarUrl?: string|null, accent?: number|null}} opts
 */
export async function renderWelcomePng(opts) {
  return renderMemberCard(opts);
}

/** Gule gule karti (PNG) veya null. */
export async function renderGoodbyePng(opts) {
  return renderMemberCard({ ...opts, accent: opts.accent ?? getColor('error') });
}

// ---------------------------------------------------------------------------
// Liderlik tablosu
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   title: string,
 *   subtitle?: string|null,
 *   items: Array<{name: string, valueText: string, avatarUrl?: string|null}>,
 *   accent?: number|null,
 * }} opts
 */
export async function renderLeaderboardPng({ title, subtitle = null, items = [], accent = null }) {
  const limited = items.slice(0, 12);
  const avatars = await Promise.all(limited.map((item) => loadImageSafe(item.avatarUrl)));

  const headerH = 128;
  const rowH = 70;
  const height = headerH + limited.length * rowH + 26;

  return withCanvas(880, height, (ctx, meta) => {
    const { width, family } = meta;
    const accentColor = accentNumber(meta, accent);

    paintCardBase(ctx, width, height, accentColor);

    drawCardHeader(ctx, width, family, { title, subtitle });

    limited.forEach((item, index) => {
      const rowY = headerH + index * rowH + 6;

      ctx.fillStyle = index % 2 === 0 ? ROW : ROW_ALT;
      roundRect(ctx, 24, rowY, width - 48, 58, 14);
      ctx.fill();

      drawRankBadge(ctx, 62, rowY + 29, index + 1, { colors: MEDALS, family });

      drawAvatar(ctx, avatars[index] ?? null, 114, rowY + 29, 20, { fallbackText: item.name, ringColor: null });

      ctx.fillStyle = '#ffffff';
      ctx.font = `600 24px ${family}`;
      ctx.textAlign = 'left';
      ctx.fillText(clipText(ctx, item.name, 520), 148, rowY + 29);

      ctx.fillStyle = toHex(accentColor);
      ctx.font = `800 26px ${family}`;
      ctx.textAlign = 'right';
      ctx.fillText(clipText(ctx, item.valueText, 200), width - 44, rowY + 29);
      ctx.textAlign = 'left';
    });
  });
}

// ---------------------------------------------------------------------------
// Profil karti
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   title: string,
 *   subtitle?: string|null,
 *   avatarUrl?: string|null,
 *   stats?: Array<{label: string, value: string}>,
 *   accent?: number|null,
 * }} opts
 */
export async function renderProfilePng({ title, subtitle = null, avatarUrl = null, stats = [], accent = null }) {
  const avatar = await loadImageSafe(avatarUrl);
  const chips = stats.slice(0, 6);
  const cols = chips.length > 4 ? 3 : 2;
  const rows = Math.max(1, Math.ceil(chips.length / cols));
  const chipW = Math.floor((832 - (cols - 1) * 16) / cols);
  const chipH = 76;
  const headerH = 218;
  const height = headerH + rows * chipH + (rows - 1) * 16 + 26;

  return withCanvas(880, height, (ctx, meta) => {
    const { width, family } = meta;
    const accentColor = accentNumber(meta, accent);

    paintCardBase(ctx, width, height, accentColor);

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(140, 120, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawAvatar(ctx, avatar, 140, 120, 72, { fallbackText: title, ringColor: accentColor, ringWidth: 6 });

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 38px ${family}`;
    ctx.fillText(clipText(ctx, title, 560), 248, 96);

    if (subtitle) {
      ctx.fillStyle = MUTED;
      ctx.font = `500 23px ${family}`;
      ctx.fillText(clipText(ctx, subtitle, 560), 248, 144);
    }

    chips.forEach((chip, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = 24 + col * (chipW + 16);
      const y = headerH + row * (chipH + 16);
      drawChip(ctx, x, y, chipW, chipH, {
        label: chip.label,
        value: chip.value,
        valueColor: '#ffffff',
        bg: ROW,
        labelColor: MUTED,
        family,
      });
    });
  });
}
