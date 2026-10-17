/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLogger } from '../core/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_LANG = 'tr';

const cache = new Map();
const warnedKeys = new Set();

function loadLocale(lang) {
  if (cache.has(lang)) return cache.get(lang);
  try {
    const raw = readFileSync(path.join(__dirname, `${lang}.json`), 'utf8');
    const parsed = JSON.parse(raw);
    cache.set(lang, parsed);
    return parsed;
  } catch {
    getLogger().warn({ lang }, `Locale dosyasi yuklenemedi: ${lang}.json; varsayilan (${DEFAULT_LANG}) kullanilir.`);
    if (lang !== DEFAULT_LANG) return loadLocale(DEFAULT_LANG);
    return {};
  }
}

function getNested(obj, key) {
  return key
    .split('.')
    .reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), obj);
}

function interpolate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = vars[name];
    return value === undefined || value === null ? match : String(value);
  });
}

/**
 * Ceviri fonksiyonu (dil acik).
 * @param {string} lang
 * @param {string} key 'moderation.ban.success' bicimi
 * @param {Record<string, unknown>} [vars]
 */
export function t(lang, key, vars = {}) {
  const locale = loadLocale(lang || DEFAULT_LANG);
  let value = getNested(locale, key);

  if (value === undefined && lang !== DEFAULT_LANG) {
    value = getNested(loadLocale(DEFAULT_LANG), key);
  }

  if (value === undefined) {
    const warnKey = `${lang}:${key}`;
    if (!warnedKeys.has(warnKey)) {
      warnedKeys.add(warnKey);
      getLogger().warn({ key, lang }, 'Eksik locale anahtari');
    }
    return key;
  }

  if (typeof value !== 'string') return value;
  return interpolate(value, vars);
}

/** Sunucu dili icin bagli cevirici uretir: const tr = createTranslator('tr'); tr('errors.cooldown', {...}) */
export function createTranslator(lang = DEFAULT_LANG) {
  return (key, vars) => t(lang, key, vars);
}
