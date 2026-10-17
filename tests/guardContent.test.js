/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import {
  containsBadWord,
  createSpamTracker,
  extractUrls,
  findLinkViolation,
  hostOf,
  isInviteUrl,
} from '../src/modules/guard/lib/content.js';

describe('link analizi', () => {
  it('URL cikarma: tekrarlar tekil, noktalama temizlenir', () => {
    expect(extractUrls('a https://x.com b https://x.com')).toEqual(['https://x.com']);
    expect(extractUrls('bak: https://a.com.')).toEqual(['https://a.com']);
    expect(extractUrls('link yok')).toEqual([]);
  });

  it('hostOf www temizler ve kucuk harfe cevirir', () => {
    expect(hostOf('https://WWW.YouTube.com/watch')).toBe('youtube.com');
    expect(hostOf('https://discord.gg/abc')).toBe('discord.gg');
    expect(hostOf('')).toBeNull();
  });

  it('davet linkleri taninir', () => {
    expect(isInviteUrl('https://discord.gg/abc')).toBe(true);
    expect(isInviteUrl('https://discord.com/invite/abc')).toBe(true);
    expect(isInviteUrl('https://discord.me/abc')).toBe(true);
    expect(isInviteUrl('https://youtube.com/watch?v=1')).toBe(false);
  });

  it('beyaz liste alan adi ve alt alan adlarini kapsar', () => {
    expect(findLinkViolation('bak https://youtube.com/x', { whitelist: ['youtube.com'] })).toBeNull();
    expect(findLinkViolation('bak https://m.youtube.com/x', { whitelist: ['youtube.com'] })).toBeNull();
  });

  it('davet linki ihlal olarak doner', () => {
    const violation = findLinkViolation('gel https://discord.gg/abc', { whitelist: [] });
    expect(violation.kind).toBe('davet');
    expect(violation.host).toBe('discord.gg');
  });

  it('blockAllLinks tum linkleri engeller', () => {
    const violation = findLinkViolation('bak https://example.com', { blockAllLinks: true });
    expect(violation?.kind).toBe('link');
    // beyaz listedeki alan yine muaf
    expect(findLinkViolation('bak https://example.com', { blockAllLinks: true, whitelist: ['example.com'] })).toBeNull();
  });
});

describe('kufur filtresi', () => {
  it('TR kucuk harf duyarli eslesme', () => {
    expect(containsBadWord('SENİ ORSSPU', ['orsspu'])).toBe('orsspu');
    expect(containsBadWord('İZMİR güzel', ['izmir'])).toBe('izmir');
    expect(containsBadWord('temiz içerik', ['kufur'])).toBeNull();
  });

  it('cok kisa kelimeler yok sayilir', () => {
    expect(containsBadWord('abc', ['ab'])).toBeNull();
  });

  it('bos liste ile hicbir sey engellenmez', () => {
    expect(containsBadWord('herhangi bir şey', [])).toBeNull();
  });
});

describe('spam takibi', () => {
  it('hiz esigi asilinca spam', () => {
    const tracker = createSpamTracker({ windowMs: 5000, maxMessages: 3 });
    expect(tracker.check('u1', 'mesaj 1').spam).toBe(false);
    expect(tracker.check('u1', 'mesaj 2').spam).toBe(false);
    expect(tracker.check('u1', 'mesaj 3').spam).toBe(false);
    const fourth = tracker.check('u1', 'mesaj 4');
    expect(fourth.spam).toBe(true);
    expect(fourth.reason).toBe('hiz');
  });

  it('tekrar eden mesaj spam sayilir', () => {
    const tracker = createSpamTracker({ windowMs: 5000, maxMessages: 10, duplicateMax: 3 });
    expect(tracker.check('u2', 'aynı mesaj').spam).toBe(false);
    expect(tracker.check('u2', 'aynı mesaj').spam).toBe(false);
    const third = tracker.check('u2', 'aynı mesaj');
    expect(third.spam).toBe(true);
    expect(third.reason).toBe('tekrar');
  });

  it('kullanicilar birbirinden bagimsiz', () => {
    const tracker = createSpamTracker({ windowMs: 5000, maxMessages: 1 });
    expect(tracker.check('a', 'x').spam).toBe(false);
    expect(tracker.check('b', 'x').spam).toBe(false);
    expect(tracker.check('a', 'y').spam).toBe(true);
  });
});
