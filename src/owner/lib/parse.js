/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { parseDuration } from '../../core/argParser.js';

export function tokenizeInput(raw) {
  return String(raw ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Bilinen bayraklari ayirir: '--guard' -> flags, kalan tokenlar -> rest. */
export function parseFlaggedInput(raw, knownFlags = []) {
  const tokens = tokenizeInput(raw);
  const flags = new Set();
  const rest = [];

  for (const token of tokens) {
    if (knownFlags.includes(token)) {
      flags.add(token);
      continue;
    }
    rest.push(token);
  }

  return { flags, rest };
}

/**
 * `!bot-durdur [süre] [sebep] [--guard]` girdisi.
 * @returns {{guard: boolean, duration: {ms: number, display: string}|null, reason: string|null}}
 */
export function parsePauseInput(raw) {
  const { flags, rest } = parseFlaggedInput(raw, ['--guard']);
  let duration = null;

  if (rest.length > 0) {
    const parsed = parseDuration(rest[0]);
    if (parsed) {
      duration = parsed;
      rest.shift();
    }
  }

  return {
    guard: flags.has('--guard'),
    duration,
    reason: rest.join(' ') || null,
  };
}

/**
 * `!kara-liste-ekle <id> [--kal] [sebep]` girdisi.
 * @returns {{keepGuild: boolean, reason: string|null}}
 */
export function parseBlacklistInput(raw) {
  const { flags, rest } = parseFlaggedInput(raw, ['--kal']);
  return {
    keepGuild: flags.has('--kal'),
    reason: rest.join(' ') || null,
  };
}

/**
 * Kapsam token'ini siniflandirir: 'global' | snowflake ID | (sunucu adi) | varsayilan.
 * @returns {{type: 'default'|'global'|'id'|'name', value?: string}}
 */
export function classifyScopeToken(token) {
  const value = String(token ?? '').trim();
  if (!value) return { type: 'default' };
  if (value === 'global') return { type: 'global' };
  if (/^\d{15,25}$/.test(value)) return { type: 'id', value };
  return { type: 'name', value };
}

/**
 * `!bot-bakım-al [süre] [sebep]` girdisi (bayraksiz).
 * @returns {{duration: {ms: number, display: string}|null, reason: string|null}}
 */
export function parseMaintenanceInput(raw) {
  const rest = tokenizeInput(raw);
  let duration = null;
  if (rest.length > 0) {
    const parsed = parseDuration(rest[0]);
    if (parsed) {
      duration = parsed;
      rest.shift();
    }
  }
  return { duration, reason: rest.join(' ') || null };
}
