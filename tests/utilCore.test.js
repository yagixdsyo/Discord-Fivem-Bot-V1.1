/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import {
  parseDuration,
  formatDuration,
  parseUserId,
  chunk,
  makeCaseId,
  dayKey,
  lastNDayKeys,
  toBigInt,
} from '../src/modules/moderation/lib/util.js';

describe('moderation util/parseDuration', () => {
  it('Turkce birimleri cozer', () => {
    expect(parseDuration('10dk')).toBe(600_000);
    expect(parseDuration('2sa')).toBe(7_200_000);
    expect(parseDuration('3g')).toBe(259_200_000);
    expect(parseDuration('45sn')).toBe(45_000);
  });

  it('coklu bilesenleri toplar', () => {
    expect(parseDuration('1g 12sa')).toBe(129_600_000);
    expect(parseDuration('2 saat 30 dk')).toBe(9_000_000);
  });

  it('birimsiz sayi DAKIKA kabul edilir', () => {
    expect(parseDuration('30')).toBe(30 * 60_000);
  });

  it('gecersiz girdilerde null doner', () => {
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(parseDuration(null)).toBeNull();
  });

  it('10 yil ile sinirlanir', () => {
    expect(parseDuration('99999g')).toBe(3650 * 86_400_000);
  });
});

describe('moderation util/formatDuration', () => {
  it('gun/saat/dk/sn yazar', () => {
    expect(formatDuration(90_000)).toBe('1 dk 30 sn');
    expect(formatDuration(86_400_000)).toBe('1 gün');
  });

  it('sifir ve negatif icin 0 sn', () => {
    expect(formatDuration(0)).toBe('0 sn');
    expect(formatDuration(-3)).toBe('0 sn');
  });
});

describe('moderation util/parseUserId', () => {
  it('etiket ve ciplak id kabul eder', () => {
    expect(parseUserId('<@123456789012345678>')).toBe('123456789012345678');
    expect(parseUserId('<@!123456789012345678>')).toBe('123456789012345678');
    expect(parseUserId('123456789012345678')).toBe('123456789012345678');
  });

  it('gecersizleri null yapar', () => {
    expect(parseUserId('abc')).toBeNull();
    expect(parseUserId('123')).toBeNull();
    expect(parseUserId(null)).toBeNull();
  });
});

describe('moderation util/chunk + makeCaseId', () => {
  it('listeyi parcalara boler', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });

  it('case id c- onekiyle uretilir ve benzersizdir', () => {
    const a = makeCaseId();
    const b = makeCaseId();
    expect(a.startsWith('c-')).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('moderation util/dayKey', () => {
  it('Istanbul saatiyle gun anahtari uretir', () => {
    // 2026-01-01T21:30:00Z -> Istanbul 2026-01-02 00:30
    const key = dayKey(new Date('2026-01-01T21:30:00Z'));
    expect(key).toBe('2026-01-02');
  });

  it('lastNDayKeys n gun doner ve son gun bugun', () => {
    const keys = lastNDayKeys(3, new Date('2026-01-10T12:00:00Z'));
    expect(keys).toHaveLength(3);
    expect(keys.at(-1)).toBe('2026-01-10');
    expect(keys[0]).toBe('2026-01-08');
  });
});

describe('moderation util/toBigInt', () => {
  it('string ve sayiyi bigint yapar, gecersizde 0n', () => {
    expect(toBigInt('123')).toBe(123n);
    expect(toBigInt(7)).toBe(7n);
    expect(toBigInt(undefined)).toBe(0n);
  });
});
