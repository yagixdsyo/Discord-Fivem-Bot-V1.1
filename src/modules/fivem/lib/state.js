/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getGuildConfig, setGuildSetting } from '../../../core/guildSettings.js';
import { insertDoc, findDocs } from './store.js';

export const STATUS_KEY = 'fivem.status';
export const CFX_KEY = 'fivem.cfx';
export const PANEL_KEY = 'fivem.status.panel';

export const STATUS_LABELS = {
  aktif: { key: 'DURUM_AKTIF', accent: 'success' },
  bakim: { key: 'DURUM_BAKIM', accent: 'warn' },
  restart: { key: 'DURUM_RESTART', accent: 'warn' },
  kapali: { key: 'DURUM_KAPALI', accent: 'error' },
};

const DEFAULT_STATUS = Object.freeze({
  state: 'aktif',
  until: null,
  note: null,
  autoRevert: true,
  updatedAt: null,
  updatedBy: null,
});

function normalizeStatus(raw) {
  const state = ['aktif', 'bakim', 'restart', 'kapali'].includes(raw?.state) ? raw.state : 'aktif';
  return {
    ...DEFAULT_STATUS,
    ...raw,
    state,
    until: raw?.until ?? null,
    note: typeof raw?.note === 'string' && raw.note.trim() ? raw.note.trim() : null,
    autoRevert: raw?.autoRevert !== false,
  };
}

/** Sunucu icin ham ayar okur (DB yoksa {} doner). */
export async function getSetting(guildId, key) {
  try {
    const config = await getGuildConfig(guildId);
    return config?.settings?.[key] ?? null;
  } catch {
    return null;
  }
}

/** Ayar yazar; DB hazir degilse false. */
export async function setSetting(guildId, key, value) {
  try {
    return await setGuildSetting(guildId, key, value);
  } catch {
    return false;
  }
}

export async function getStatus(guildId) {
  return normalizeStatus(await getSetting(guildId, STATUS_KEY));
}

export async function setStatus(guildId, state, { until = null, note = null, by = null, autoRevert = true } = {}) {
  const doc = {
    state,
    until: until ? new Date(until).toISOString() : null,
    note,
    autoRevert,
    updatedAt: new Date().toISOString(),
    updatedBy: by,
  };
  const ok = await setSetting(guildId, STATUS_KEY, doc);
  if (!ok) return { ok: false, status: normalizeStatus(doc) };

  await insertDoc('fivem_status_history', {
    guild_id: guildId,
    state,
    until: doc.until,
    note,
    by,
  }).catch(() => {});

  return { ok: true, status: normalizeStatus(doc) };
}

/** Durum gecmisi (en yeni ilk). */
export async function listStatusHistory(guildId, { limit = 10 } = {}) {
  try {
    return await findDocs('fivem_status_history', { guild_id: guildId }, { sort: { created_at: -1 }, limit });
  } catch {
    return [];
  }
}

/** CFX yapilandirmasi: {code, secret, ip, joinedAt}. */
export async function getCfx(guildId) {
  const raw = await getSetting(guildId, CFX_KEY);
  return {
    code: raw?.code ?? null,
    secret: raw?.secret ?? null,
    ip: raw?.ip ?? null,
    joinedAt: raw?.joinedAt ?? null,
  };
}

export async function setCfx(guildId, patch = {}) {
  const current = await getCfx(guildId);
  const merged = {
    code: patch.code !== undefined ? patch.code : current.code,
    secret: patch.secret !== undefined ? patch.secret : current.secret,
    ip: patch.ip !== undefined ? patch.ip : current.ip,
    joinedAt: patch.joinedAt !== undefined ? patch.joinedAt : current.joinedAt,
  };
  const ok = await setSetting(guildId, CFX_KEY, merged);
  return ok ? merged : null;
}

/** Durum paneli yapilandirmasi: {channelId, messageId, autoOffline}. */
export async function getPanelConfig(guildId) {
  const raw = await getSetting(guildId, PANEL_KEY);
  return {
    channelId: raw?.channelId ?? null,
    messageId: raw?.messageId ?? null,
    autoOffline: raw?.autoOffline !== false,
  };
}

export async function setPanelConfig(guildId, patch = {}) {
  const current = await getPanelConfig(guildId);
  const merged = {
    channelId: patch.channelId !== undefined ? patch.channelId : current.channelId,
    messageId: patch.messageId !== undefined ? patch.messageId : current.messageId,
    autoOffline: patch.autoOffline !== undefined ? patch.autoOffline : current.autoOffline,
  };
  const ok = await setSetting(guildId, PANEL_KEY, merged);
  return ok ? merged : null;
}
