/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import { ANNOUNCE_KINDS, shortId, validateAnnouncementInput } from '../src/core/announcements.js';

describe('ANNOUNCE_KINDS', () => {
  it('uc duyuru turu tanimli', () => {
    expect(ANNOUNCE_KINDS).toEqual(['guncelleme', 'yenilik', 'bakim']);
  });
});

describe('validateAnnouncementInput', () => {
  it('gecerli girdi temizlenir', () => {
    const result = validateAnnouncementInput({ title: '  Sürüm 2  ', body: '  - Madde  ', version: ' v2.1 ' });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({ title: 'Sürüm 2', body: '- Madde', version: 'v2.1' });
  });

  it('bos baslik hata doner', () => {
    const result = validateAnnouncementInput({ title: '   ', body: 'icerik' });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('title_empty');
  });

  it('uzun baslik hata doner', () => {
    const result = validateAnnouncementInput({ title: 'a'.repeat(101), body: 'icerik' });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('title_long');
  });

  it('bos icerik hata doner', () => {
    const result = validateAnnouncementInput({ title: 'Baslik', body: '' });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('body_empty');
  });

  it('uzun icerik hata doner', () => {
    const result = validateAnnouncementInput({ title: 'Baslik', body: 'b'.repeat(2001) });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('body_long');
  });

  it('bos surum null olur (hata degil)', () => {
    const result = validateAnnouncementInput({ title: 'Baslik', body: 'icerik', version: '  ' });
    expect(result.ok).toBe(true);
    expect(result.value.version).toBeNull();
  });

  it('gecersiz surum karakterleri hata doner', () => {
    const result = validateAnnouncementInput({ title: 'Baslik', body: 'icerik', version: 'v 1/2' });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('version_invalid');
  });

  it('sürüm: nokta/tire/alt cizgi kabul edilir', () => {
    for (const version of ['1.2.3', 'v2-beta', 'v3_1']) {
      const result = validateAnnouncementInput({ title: 'Baslik', body: 'icerik', version });
      expect(result.ok).toBe(true);
    }
  });

  it('tamamen bos girdi birden fazla hata doner', () => {
    const result = validateAnnouncementInput();
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(['title_empty', 'body_empty']));
  });
});

describe('shortId', () => {
  it('objectId son 6 karakterini doner', () => {
    const doc = { _id: { toString: () => '64f1a2b3c4d5e6f7a8b9c0d1' } };
    expect(shortId(doc)).toBe('b9c0d1');
  });

  it('bos/eksik dokumanda bos string doner', () => {
    expect(shortId(null)).toBe('');
    expect(shortId({})).toBe('');
  });
});
