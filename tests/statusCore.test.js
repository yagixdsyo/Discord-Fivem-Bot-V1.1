/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { settingsStore } = vi.hoisted(() => ({ settingsStore: new Map() }));

vi.mock('../src/core/guildSettings.js', () => ({
  getGuildConfig: vi.fn(async (guildId) => ({ settings: settingsStore.get(guildId) ?? {} })),
  setGuildSetting: vi.fn(async (guildId, key, value) => {
    const settings = settingsStore.get(guildId) ?? {};
    settings[key] = value;
    settingsStore.set(guildId, settings);
    return true;
  }),
  invalidateGuildConfig: vi.fn(async () => {}),
}));

vi.mock('../src/modules/fivem/lib/maps.js', () => ({
  getChannelId: vi.fn(async () => null),
  getRoleId: vi.fn(async () => null),
  resolveChannel: vi.fn(async () => null),
  resolveRole: vi.fn(async () => null),
  clearMapsCache: vi.fn(),
}));

import { createTranslator } from '../src/locales/index.js';
import { clearFivemMemory } from '../src/modules/fivem/lib/store.js';
import { getChannelId, getRoleId } from '../src/modules/fivem/lib/maps.js';
import { cfxJoinLink, extractCfxCode } from '../src/modules/fivem/lib/cfx.js';
import {
  getCfx,
  getPanelConfig,
  getStatus,
  listStatusHistory,
  setCfx,
  setPanelConfig,
  setStatus,
  STATUS_LABELS,
} from '../src/modules/fivem/lib/state.js';
import { buildStatusPayload } from '../src/modules/fivem/lib/statusPanel.js';
import { announceStatus, applyStatusChange } from '../src/modules/fivem/lib/statusFlow.js';

const t = createTranslator('tr');

function fakeChannel(id, sentBox) {
  return {
    id,
    send: vi.fn(async (payload) => {
      sentBox.push({ channelId: id, payload });
      return { id: `${id}-msg`, edit: vi.fn(async () => {}) };
    }),
    messages: { fetch: vi.fn(async () => null) },
  };
}

function fakeGuild() {
  const sent = [];
  const guild = {
    id: 'g1',
    name: 'Test Sunucu',
    channels: {
      cache: new Map(),
      fetch: vi.fn(async () => null),
    },
    _sent: sent,
  };
  for (const id of ['c-panel', 'c-duyuru']) {
    guild.channels.cache.set(id, fakeChannel(id, sent));
  }
  return guild;
}

beforeEach(() => {
  clearFivemMemory();
  settingsStore.clear();
  getChannelId.mockReset();
  getChannelId.mockResolvedValue(null);
  getRoleId.mockReset();
  getRoleId.mockResolvedValue(null);
});

describe('state/durum', () => {
  it('varsayilan aktif + autoRevert true', async () => {
    expect(await getStatus('g1')).toMatchObject({ state: 'aktif', until: null, autoRevert: true });
  });

  it('gecersiz durum aktif olarak normalize edilir', async () => {
    await setStatus('g1', 'saçma');
    expect((await getStatus('g1')).state).toBe('aktif');
  });

  it('setStatus kaydeder, gecmise yazar, autoRevert saklanir', async () => {
    const until = new Date(Date.now() + 3_600_000).toISOString();
    const result = await setStatus('g1', 'bakim', { until, note: 'guncelleme', by: 'u1' });
    expect(result.ok).toBe(true);
    expect(result.status).toMatchObject({ state: 'bakim', note: 'guncelleme', updatedBy: 'u1', autoRevert: true });

    const history = await listStatusHistory('g1');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ state: 'bakim', by: 'u1' });

    await setStatus('g1', 'kapali', { by: 'u1', autoRevert: false });
    expect((await getStatus('g1')).autoRevert).toBe(false);
    expect(STATUS_LABELS.kapali.accent).toBe('error');
  });
});

describe('state/cfx ve panel ayarlari', () => {
  it('cfx alanlari birlestirilir', async () => {
    await setCfx('g1', { code: 'abc123' });
    expect(await getCfx('g1')).toMatchObject({ code: 'abc123', secret: null });

    await setCfx('g1', { secret: 'hmac' });
    expect(await getCfx('g1')).toMatchObject({ code: 'abc123', secret: 'hmac' });
  });

  it('panel ayarlari birlestirilir ve varsayilan autoOffline true', async () => {
    expect(await getPanelConfig('g1')).toEqual({ channelId: null, messageId: null, autoOffline: true });
    await setPanelConfig('g1', { channelId: 'c-panel', messageId: 'm1' });
    expect(await getPanelConfig('g1')).toMatchObject({ channelId: 'c-panel', messageId: 'm1' });
  });

  it('extractCfxCode link ve kodu cozer', () => {
    expect(extractCfxCode('https://cfx.re/join/AbC123')).toBe('abc123');
    expect(extractCfxCode('cfx.re/join/abc123')).toBe('abc123');
    expect(extractCfxCode('ABC123')).toBe('abc123');
    expect(extractCfxCode('kısa')).toBe(null);
    expect(extractCfxCode('')).toBe(null);
    expect(cfxJoinLink('abc123')).toBe('https://cfx.re/join/abc123');
    expect(cfxJoinLink(null)).toBe(null);
  });
});

describe('statusPanel/buildStatusPayload', () => {
  it('aktif durum + IP satirini uretir', () => {
    const payload = buildStatusPayload(t, {
      status: { state: 'aktif', until: null, note: null, updatedAt: null, updatedBy: null },
      cfx: { code: null, ip: '1.2.3.4' },
      info: null,
      guildName: 'Test Sunucu',
    });
    const json = JSON.stringify(payload);
    expect(json).toContain('Güncel durum');
    expect(json).toContain('Aktif');
    expect(json).toContain('1.2.3.4');
    expect(json).toContain('Panel henüz güncellenmedi.');
  });

  it('oyuncu sayisi + bitis + not satirlarini ekler', () => {
    const until = new Date(Date.now() + 3_600_000).toISOString();
    const payload = buildStatusPayload(t, {
      status: { state: 'bakim', until, note: 'guncelleme', updatedAt: new Date().toISOString(), updatedBy: 'u1' },
      cfx: { code: 'abc', ip: null },
      info: { ok: true, players: 12, maxPlayers: 64 },
      guildName: null,
    });
    const json = JSON.stringify(payload);
    expect(json).toContain('Bakım');
    expect(json).toContain('**12** / 64');
    expect(json).toContain('guncelleme');
    expect(json).toContain('<@u1>');
    expect(json).toContain('cfx.re/join/abc');
  });

  it('cfx kodu varsa ama bilgi yoksa cevrimdisi notu', () => {
    const payload = buildStatusPayload(t, {
      status: { state: 'kapali', until: null, note: null, updatedAt: new Date().toISOString(), updatedBy: null },
      cfx: { code: 'abc', ip: null },
      info: null,
      guildName: null,
    });
    expect(JSON.stringify(payload)).toContain('CFX API');
  });
});

describe('statusFlow/announceStatus', () => {
  it('duyuru kanalina kart gonderir ve rol pingini allowedMentions ile sinirlar', async () => {
    getChannelId.mockImplementation(async (_guildId, key) => (key === 'duyurular' ? 'c-duyuru' : null));
    const guild = fakeGuild();

    const ok = await announceStatus(guild, t, { state: 'bakim', pingRoleId: 'r-wh' });
    expect(ok).toBe(true);
    expect(guild._sent).toHaveLength(1);
    const { payload } = guild._sent[0];
    expect(payload.allowedMentions).toEqual({ roles: ['r-wh'] });
    expect(JSON.stringify(payload)).toContain('Sunucu Durumu Güncellendi');
  });

  it('duyuru kanali yoksa false doner', async () => {
    const guild = fakeGuild();
    expect(await announceStatus(guild, t, { state: 'aktif' })).toBe(false);
  });
});

describe('statusFlow/applyStatusChange', () => {
  it('durumu yazar, paneli kurar ve duyuruyu gonderir', async () => {
    getChannelId.mockImplementation(async (_guildId, key) => {
      if (key === 'panel_durum') return 'c-panel';
      if (key === 'duyurular') return 'c-duyuru';
      return null;
    });
    getRoleId.mockImplementation(async (_guildId, key) => (key === 'whitelist' ? 'r-wh' : null));

    const guild = fakeGuild();
    const ctx = { guild, user: { id: 'u1' }, t };

    const result = await applyStatusChange(ctx, { state: 'bakim', ping: true });
    expect(result.ok).toBe(true);
    expect(result.panel).toMatchObject({ ok: true, posted: true });

    const status = await getStatus('g1');
    expect(status.state).toBe('bakim');
    expect(status.autoRevert).toBe(true);

    const panelSent = guild._sent.find((entry) => entry.channelId === 'c-panel');
    expect(panelSent).toBeDefined();
    expect((await getPanelConfig('g1')).messageId).toBe('c-panel-msg');

    const duyuru = guild._sent.find((entry) => entry.channelId === 'c-duyuru');
    expect(duyuru.payload.allowedMentions).toEqual({ roles: ['r-wh'] });
  });

  it('kapali durumda autoRevert kapanir', async () => {
    const guild = fakeGuild();
    const ctx = { guild, user: { id: 'u1' }, t };
    const result = await applyStatusChange(ctx, { state: 'kapali' });
    expect(result.ok).toBe(true);
    expect((await getStatus('g1')).autoRevert).toBe(false);
  });
});
