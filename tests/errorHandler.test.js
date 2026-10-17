/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import {
  generateErrorCode,
  reportError,
  getRecentErrors,
  findErrorByCode,
  AppError,
} from '../src/core/errorHandler.js';

describe('errorHandler', () => {
  it('hata kodu ERR-XXXXXX biciminde uretilir', () => {
    const code = generateErrorCode();
    expect(code).toMatch(/^ERR-[0-9A-F]{6}$/);
  });

  it('uretilen kodlar pratikte benzersizdir (1000 adet)', () => {
    const codes = new Set();
    for (let i = 0; i < 1000; i++) codes.add(generateErrorCode());
    expect(codes.size).toBeGreaterThan(990);
  });

  it('reportError kaydi bellekte tutar ve kod doner', async () => {
    const entry = await reportError(new Error('test hatasi'), {
      source: 'test',
      guildId: '111',
      command: 'test-komut',
    });

    expect(entry.code).toMatch(/^ERR-/);
    expect(entry.context.source).toBe('test');
    expect(entry.context.guildId).toBe('111');

    const recent = getRecentErrors();
    expect(recent[0].code).toBe(entry.code);
  });

  it('AppError userMessage alanini kayda tasir', async () => {
    const entry = await reportError(
      new AppError('teknik detay', { userMessage: 'Kullaniciya gosterilecek mesaj' }),
      { source: 'test' },
    );
    expect(entry.userMessage).toBe('Kullaniciya gosterilecek mesaj');
  });

  it('findErrorByCode son hatalari bulur (bellek katmani)', async () => {
    const entry = await reportError(new Error('aranan hata'), { source: 'test' });
    const found = await findErrorByCode(entry.code);
    expect(found).toBeTruthy();
    expect(found.code).toBe(entry.code);

    const missing = await findErrorByCode('ERR-000000');
    expect(missing).toBeNull();
  });

  it('Error olmayan degerler de raporlanabilir (asla firlatmaz)', async () => {
    const entry = await reportError('duz string hata', { source: 'test' });
    expect(entry.message).toContain('duz string hata');
  });
});
