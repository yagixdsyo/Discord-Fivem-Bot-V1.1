/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import {
  AUTO_INTERVAL_HOURS,
  AUTO_INTERVAL_OPTIONS,
  getAutoIntervalHours,
  setAutoIntervalHours,
} from '../src/modules/backup/lib/auto.js';

describe('otomatik backup araligi', () => {
  it('DB yokken varsayilan 12 saat', async () => {
    expect(await getAutoIntervalHours('1')).toBe(12);
    expect(AUTO_INTERVAL_HOURS).toBe(12);
  });

  it('kabul edilen aralik listesi 6/12/24', () => {
    expect([...AUTO_INTERVAL_OPTIONS]).toEqual([6, 12, 24]);
  });

  it('gecersiz aralik reddedilir', async () => {
    const result = await setAutoIntervalHours('1', 5);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('gecersiz_aralik');
  });

  it('gecerli aralik DB yokken yazilamaz, hata doner', async () => {
    const result = await setAutoIntervalHours('1', 6);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('db_hazir_degil');
  });
});
