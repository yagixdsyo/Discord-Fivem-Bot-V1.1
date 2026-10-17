/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  getGuildSystemList,
  getSystem,
  isSystemActive,
  registerSystems,
  setSystemEnabled,
} from '../../../core/systemRegistry.js';
import { SYSTEMS } from './catalog.js';

registerSystems(SYSTEMS);

export { SYSTEMS };

const TR_MAP = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** Turkce duyarli normalizasyon: 'Özel Oda' -> 'ozeloda', 'İ' -> 'i' */
export function normalizeTr(input) {
  const prepared = String(input ?? '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLowerCase()
    // 'İ'.toLowerCase bazi motorlarda i + birlestirici nokta uretir; temizle
    .replace(/[\u0300-\u036f]/g, '');
  return prepared
    .split('')
    .map((ch) => TR_MAP[ch] ?? ch)
    .join('')
    .replace(/[\s_\-'.]/g, '');
}

/**
 * Kullanici girdisinden sistem bulur (id / ad / modul id eslesmesi).
 * @returns {object|null}
 */
export function resolveSystem(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  const direct = getSystem(raw) ?? getSystem(raw.toLowerCase());
  if (direct) return direct;

  const norm = normalizeTr(raw);
  if (!norm) return null;

  for (const def of SYSTEMS) {
    if (normalizeTr(def.id) === norm || normalizeTr(def.name) === norm) return def;
    if (def.moduleId && normalizeTr(def.moduleId) === norm) return def;
  }
  return null;
}

/** Sunucu icin sistem listesi (durum tablosu). */
export function listGuildSystems(guildId) {
  return getGuildSystemList(guildId);
}

/** Sistem aktif mi? (modul + sistem katmani) */
export function isSystemOn(guildId, systemId) {
  return isSystemActive({ guildId, systemId });
}

/** Sistem ac/kapat. */
export function setSystemState({ guildId, systemId, enabled, by = null, reason = null }) {
  return setSystemEnabled({ guildId, systemId, enabled, by, reason });
}
