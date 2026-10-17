/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { clipText, roundRect, withCanvas } from './canvas.js';

export { renderWelcomePng, renderGoodbyePng, renderLeaderboardPng, renderProfilePng } from '../../../ui/canvas/cards.js';

/**
 * Yatay bar grafigi uretir (PNG) veya null.
 * @param {{title: string, subtitle?: string|null, items: Array<{label: string, value: number, valueText?: string}>, color?: string|null}} opts
 */
export function renderBarChart({ title, subtitle = null, items = [], color = null }) {
  const height = 130 + Math.max(items.length, 1) * 48 + 20;
  return withCanvas(880, height, (ctx, meta) => {
    const { width, family, colors } = meta;
    const barColor = color ?? colors.primary;

    ctx.fillStyle = '#14161c';
    roundRect(ctx, 0, 0, width, height, 24);
    ctx.fill();

    ctx.fillStyle = colors.primary;
    roundRect(ctx, 0, 0, width, 8, 4);
    ctx.fill();

    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 32px ${family}`;
    ctx.fillText(clipText(ctx, title, width - 60), 30, 52);
    if (subtitle) {
      ctx.fillStyle = '#9aa0aa';
      ctx.font = `500 20px ${family}`;
      ctx.fillText(clipText(ctx, subtitle, width - 60), 30, 88);
    }

    const max = Math.max(1, ...items.map((item) => item.value));
    const rows = items.length > 0 ? items : [{ label: '-', value: 0 }];
    rows.forEach((item, index) => {
      const y = 136 + index * 48;
      ctx.fillStyle = '#c8ccd4';
      ctx.font = `600 22px ${family}`;
      ctx.fillText(clipText(ctx, item.label, 360), 30, y);

      const barX = 400;
      const barW = width - 400 - 180;
      ctx.fillStyle = '#2a2d36';
      roundRect(ctx, barX, y - 10, barW, 20, 10);
      ctx.fill();
      const filled = Math.max(6, Math.round((item.value / max) * barW));
      ctx.fillStyle = barColor;
      roundRect(ctx, barX, y - 10, filled, 20, 10);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 20px ${family}`;
      ctx.fillText(clipText(ctx, item.valueText ?? String(item.value), 160), width - 170, y);
    });
  });
}
