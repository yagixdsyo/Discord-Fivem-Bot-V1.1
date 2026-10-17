/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import { renderServerCardPng } from '../src/ui/canvas/server.js';
import { serverInfoPayload, statusChangePayload } from '../src/modules/fivem/lib/view.js';
import { createTranslator } from '../src/locales/index.js';
import { getColor } from '../src/ui/colors.js';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

function isPng(buffer) {
  return Buffer.isBuffer(buffer) && PNG_MAGIC.every((byte, index) => buffer[index] === byte);
}

const t = createTranslator('tr');

describe('sunucu durum canvas', () => {
  it('oyuncu sayili kart PNG uretir', async () => {
    const png = await renderServerCardPng({
      title: t('fivem.info.title', { sunucu: 'Test RP' }),
      subtitle: `${t('fivem.info.ip')}: 1.2.3.4`,
      statusText: t('fivem.info.online_label'),
      statusColor: getColor('success'),
      online: { current: 12, max: 64 },
      playersLabel: t('fivem.info.players'),
      chips: [
        { label: t('fivem.info.cfx'), value: 'abc123' },
        { label: t('fivem.info.tracked'), value: '5' },
      ],
    });
    expect(isPng(png)).toBe(true);
  });

  it('oyuncu bilgisi olmadan kompakt kart PNG uretir', async () => {
    const png = await renderServerCardPng({
      title: t('fivem.info.title', { sunucu: 'Test RP' }),
      statusText: t('fivem.info.offline_label'),
      statusColor: getColor('error'),
      online: null,
      chips: [{ label: t('fivem.info.cfx'), value: 'abc123' }],
    });
    expect(isPng(png)).toBe(true);
  });
});

describe('statusChangePayload', () => {
  it('durum basina accent rengi uygular', () => {
    const cases = [
      ['aktif', getColor('success')],
      ['bakim', getColor('warn')],
      ['restart', getColor('warn')],
      ['kapali', getColor('error')],
    ];
    for (const [state, expected] of cases) {
      const raw = statusChangePayload(t, { state }).components[0].toJSON();
      const accent = raw.accent_color ?? raw.accentColor;
      expect(accent).toBe(expected);
    }
  });

  it('sure ve not satirlarini tasir', () => {
    const until = new Date(Date.now() + 3600_000).toISOString();
    const raw = JSON.stringify(statusChangePayload(t, { state: 'bakim', until, note: 'guncelleme var' }));
    expect(raw).toContain('Bakım');
    expect(raw).toContain('guncelleme var');
    expect(raw).toContain('<t:');
  });

  it('ek satirlari (panel durumu) kartta gosterir', () => {
    const raw = JSON.stringify(statusChangePayload(t, { state: 'aktif', lines: [t('fivem.status.panel_ok')] }));
    expect(raw).toContain('panel');
  });
});

describe('sunucuInfoPayload canvas', () => {
  it('cevrimici sunucuda canvas dosyasi tasir', async () => {
    const payload = await serverInfoPayload(t, {
      guild: { id: 'g1', name: 'Sunucu' },
      cfx: { code: 'abc123', ip: '1.2.3.4' },
      info: { ok: true, name: 'Test RP', players: 5, maxPlayers: 64 },
      ip: '1.2.3.4',
      rulesChannel: 'c1',
      rulesChannelName: 'kurallar',
      trackedOnline: 3,
    });
    expect(payload.files).toHaveLength(1);
    expect(isPng(payload.files[0].attachment)).toBe(true);
  });

  it('cevrimdisi sunucuda da canvas karti uretilir', async () => {
    const payload = await serverInfoPayload(t, {
      guild: { id: 'g2', name: 'Sunucu' },
      cfx: { code: 'abc123', ip: null },
      info: null,
    });
    expect(payload.files).toHaveLength(1);
    expect(isPng(payload.files[0].attachment)).toBe(true);
  });
});
