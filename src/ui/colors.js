/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

const DEFAULTS = Object.freeze({
  primary: '#5865F2',
  success: '#57F287',
  error: '#ED4245',
  warn: '#FEE75C',
  info: '#3B82F6',
});

let colors = { ...DEFAULTS };

export function initColors(cfg) {
  colors = { ...DEFAULTS, ...(cfg ?? {}) };
  return colors;
}

/** '#5865F2' -> 0x5865F2 (integer). Gecersizse fallback primary. */
export function colorToInt(hex) {
  if (typeof hex === 'number') return hex;
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ''));
  if (!match) return colorToInt(DEFAULTS.primary);
  return parseInt(match[1], 16);
}

export function getColor(name) {
  return colorToInt(colors[name] ?? DEFAULTS[name] ?? DEFAULTS.primary);
}

export function getColors() {
  return { ...colors };
}
