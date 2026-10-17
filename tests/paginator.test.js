/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { buildPageCustomId, pageButtons, parsePageCustomId } from '../src/ui/paginator.js';
import { initEmoji } from '../src/ui/emoji.js';

// Sayfa butonlari emoji ile uretilir; test ortaminda emoji haritasini kur.
beforeEach(() => {
  initEmoji({
    source: 'guild',
    guildId: 'g1',
    map: {
      OK_ILK: { id: '123456789012345671', animated: false },
      OK_SOL: { id: '123456789012345672', animated: false },
      OK_SAG: { id: '123456789012345673', animated: false },
      OK_SON: { id: '123456789012345674', animated: false },
    },
    missingKeys: [],
  });
});

function buttonIds({ page, totalPages, ownerId = 'u1' }) {
  const rowBuilder = pageButtons({ namespace: 'test-liste', page, totalPages, ownerId });
  return rowBuilder.toJSON().components.map((c) => c.custom_id);
}

describe('pageButtons customId essizligi', () => {
  it('ilk sayfada (prev/next ayni sayfayi gosterse de) idler essiz', () => {
    const ids = buttonIds({ page: 0, totalPages: 3 });
    expect(ids.length).toBe(5);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('orta sayfada essiz', () => {
    const ids = buttonIds({ page: 1, totalPages: 3 });
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('son sayfada essiz', () => {
    const ids = buttonIds({ page: 2, totalPages: 3 });
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('2 sayfali listenin ilk sayfasinda next ve last ayni hedefi gosterir; idler yine essiz', () => {
    const ids = buttonIds({ page: 0, totalPages: 2 });
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('roller f/p/n/l butonlarina islenir', () => {
    const ids = buttonIds({ page: 1, totalPages: 5 });
    expect(ids[0]).toBe(buildPageCustomId('test-liste', 0, 'u1', 'f'));
    expect(ids[1]).toBe(buildPageCustomId('test-liste', 0, 'u1', 'p'));
    expect(ids[3]).toBe(buildPageCustomId('test-liste', 2, 'u1', 'n'));
    expect(ids[4]).toBe(buildPageCustomId('test-liste', 4, 'u1', 'l'));
  });

  it('emoji eksikse yedek etiketlerle yine gecerli govde uretir', () => {
    initEmoji({ source: 'guild', guildId: 'g1', map: {}, missingKeys: ['OK_ILK', 'OK_SOL', 'OK_SAG', 'OK_SON'] });
    const rowBuilder = pageButtons({ namespace: 'test-liste', page: 0, totalPages: 3, ownerId: 'u1' });
    const buttons = rowBuilder.toJSON().components;
    expect(buttons.length).toBe(5);
    for (const btn of buttons.slice(0, 5)) {
      expect(Boolean(btn.label || btn.emoji)).toBe(true);
    }
  });
});

describe('parsePageCustomId', () => {
  it('yeni bicimi cozer (rol dahil)', () => {
    expect(parsePageCustomId(buildPageCustomId('ns', 4, 'u9', 'n'))).toEqual({
      namespace: 'ns',
      ownerId: 'u9',
      page: 4,
      role: 'n',
    });
  });

  it('eski bicimi geriye uyumlu cozer', () => {
    expect(parsePageCustomId('ui:pg:ns:u9:2')).toEqual({ namespace: 'ns', ownerId: 'u9', page: 2 });
  });

  it('gosterge/gecersiz idler icin null doner', () => {
    expect(parsePageCustomId('ui:pg:gostergesi:u9')).toBeNull();
    expect(parsePageCustomId('ui:pg:ns:u9:x')).toBeNull();
    expect(parsePageCustomId('baska:id')).toBeNull();
    expect(parsePageCustomId(null)).toBeNull();
  });
});
