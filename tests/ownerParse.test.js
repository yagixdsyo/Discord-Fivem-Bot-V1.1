/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import {
  classifyScopeToken,
  parseBlacklistInput,
  parseFlaggedInput,
  parseMaintenanceInput,
  parsePauseInput,
  tokenizeInput,
} from '../src/owner/lib/parse.js';

describe('tokenizeInput', () => {
  it('bosluklari sadelestirir', () => {
    expect(tokenizeInput('  a   b  ')).toEqual(['a', 'b']);
    expect(tokenizeInput('')).toEqual([]);
    expect(tokenizeInput(null)).toEqual([]);
  });
});

describe('parseFlaggedInput', () => {
  it('bilinen bayraklari ayirir', () => {
    const { flags, rest } = parseFlaggedInput('30 --guard bakim', ['--guard']);
    expect([...flags]).toEqual(['--guard']);
    expect(rest).toEqual(['30', 'bakim']);
  });

  it('bilinmeyen bayrak metin olarak kalir', () => {
    const { flags, rest } = parseFlaggedInput('--baska sey', ['--guard']);
    expect([...flags]).toEqual([]);
    expect(rest).toEqual(['--baska', 'sey']);
  });
});

describe('parsePauseInput', () => {
  it('ciplak sayi dakika + sebep', () => {
    const result = parsePauseInput('30 yogunluk var');
    expect(result.guard).toBe(false);
    expect(result.duration).toEqual({ ms: 30 * 60_000, display: expect.any(String) });
    expect(result.reason).toBe('yogunluk var');
  });

  it('sure + --guard bayragi', () => {
    const result = parsePauseInput('2sa tamir --guard');
    expect(result.guard).toBe(true);
    expect(result.duration?.ms).toBe(2 * 60 * 60_000);
    expect(result.reason).toBe('tamir');
  });

  it('sure yoksa sure null kalir, sebep tumu olur', () => {
    const result = parsePauseInput('acil durum');
    expect(result.duration).toBeNull();
    expect(result.reason).toBe('acil durum');
  });

  it('bos girdi', () => {
    const result = parsePauseInput('');
    expect(result).toEqual({ guard: false, duration: null, reason: null });
  });
});

describe('parseBlacklistInput', () => {
  it('--kal bayragini tanir', () => {
    expect(parseBlacklistInput('--kal spam')).toEqual({ keepGuild: true, reason: 'spam' });
  });

  it('bayraksiz sebep', () => {
    expect(parseBlacklistInput('dolandiricilik')).toEqual({ keepGuild: false, reason: 'dolandiricilik' });
  });

  it('bos girdi', () => {
    expect(parseBlacklistInput('')).toEqual({ keepGuild: false, reason: null });
  });
});

describe('parseMaintenanceInput', () => {
  it('sure + sebep', () => {
    const result = parseMaintenanceInput('45 planli bakim');
    expect(result.duration?.ms).toBe(45 * 60_000);
    expect(result.reason).toBe('planli bakim');
  });

  it('suresiz', () => {
    const result = parseMaintenanceInput('acil');
    expect(result.duration).toBeNull();
    expect(result.reason).toBe('acil');
  });
});

describe('classifyScopeToken', () => {
  it('bos -> default (global)', () => {
    expect(classifyScopeToken('')).toEqual({ type: 'default' });
    expect(classifyScopeToken(null)).toEqual({ type: 'default' });
  });

  it('global anahtar kelimesi', () => {
    expect(classifyScopeToken('global')).toEqual({ type: 'global' });
  });

  it('snowflake ID', () => {
    const id = '123456789012345678';
    expect(classifyScopeToken(id)).toEqual({ type: 'id', value: id });
  });

  it('kisa sayi ID sayilmaz (isim aramasi)', () => {
    expect(classifyScopeToken('123')).toEqual({ type: 'name', value: '123' });
  });

  it('metin -> isim aramasi', () => {
    expect(classifyScopeToken('FiveM Sunucum')).toEqual({ type: 'name', value: 'FiveM Sunucum' });
  });
});
