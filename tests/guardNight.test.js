/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import {
  defaultNightDoc,
  nightPermsMask,
  nowSecondsInTz,
  parseTime,
  withinWindow,
} from '../src/modules/guard/lib/night.js';

describe('saat cozumleme', () => {
  it('HH:MM -> gun ici saniye', () => {
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('07:30')).toBe(27000);
    expect(parseTime('23:59')).toBe(86340);
  });

  it('gecersiz saatler null doner', () => {
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('12:60')).toBeNull();
    expect(parseTime('abc')).toBeNull();
    expect(parseTime('')).toBeNull();
    expect(parseTime(null)).toBeNull();
  });
});

describe('pencere hesabi', () => {
  it('duz aralikta dogru sonuc', () => {
    expect(withinWindow(3600, 0, 7200)).toBe(true);
    expect(withinWindow(0, 0, 7200)).toBe(true);
    expect(withinWindow(7200, 0, 7200)).toBe(false);
  });

  it('gece yarisini asan aralik (22:00-06:00)', () => {
    const start = parseTime('22:00');
    const end = parseTime('06:00');
    expect(withinWindow(parseTime('23:00'), start, end)).toBe(true);
    expect(withinWindow(parseTime('05:00'), start, end)).toBe(true);
    expect(withinWindow(parseTime('12:00'), start, end)).toBe(false);
    expect(withinWindow(parseTime('22:00'), start, end)).toBe(true);
    expect(withinWindow(parseTime('06:00'), start, end)).toBe(false);
  });

  it('baslangic = bitis ise pencere kapali', () => {
    expect(withinWindow(1000, 3600, 3600)).toBe(false);
  });

  it('gecersiz degerlerde pencere kapali', () => {
    expect(withinWindow(1000, null, 3600)).toBe(false);
  });
});

describe('saat dilimi', () => {
  it('Europe/Istanbul UTC+3 uygular', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    expect(nowSecondsInTz('Europe/Istanbul', date)).toBe(3 * 3600);
  });

  it('gecersiz saat diliminde UTC kullanilir (istisna firlatmaz)', () => {
    const date = new Date('2026-01-01T01:30:00Z');
    expect(nowSecondsInTz('Yok/BoyleBolge', date)).toBe(1 * 3600 + 30 * 60);
  });
});

describe('gece modu kapsami', () => {
  it('varsayilan dokuman kapali ve pencere 00:00-07:00', () => {
    const doc = defaultNightDoc();
    expect(doc.enabled).toBe(false);
    expect(doc.start).toBe('00:00');
    expect(doc.end).toBe('07:00');
    expect(doc.sleeping).toBe(false);
    expect(Array.isArray(doc.snapshot)).toBe(true);
  });

  it('izin maskesi dogru uretilir', () => {
    const adminMask = nightPermsMask(['Administrator']);
    expect(adminMask).toBeGreaterThan(0n);
    expect(nightPermsMask([])).toBe(0n);
    expect(nightPermsMask(['YokBoyleİzin'])).toBe(0n);
  });
});
