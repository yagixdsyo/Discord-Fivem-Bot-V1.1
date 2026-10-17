/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import {
  flushUsage,
  recordCommandUsage,
  stopUsageStats,
  usageBufferSize,
  usageReport,
} from '../src/core/usageStats.js';

describe('usageStats (DB hazir degilken)', () => {
  it('DB yoksa kayit tampona alinmaz', () => {
    recordCommandUsage({ guildId: '1', command: 'ping', ok: true });
    recordCommandUsage({ command: 'ping', ok: false });
    expect(usageBufferSize()).toBe(0);
  });

  it('bos tampon flush 0 doner', async () => {
    expect(await flushUsage()).toBe(0);
  });

  it('usageReport ok=false doner', async () => {
    const report = await usageReport();
    expect(report.ok).toBe(false);
    expect(report.windows).toEqual({});
  });

  it('stopUsageStats guvenle calisir', async () => {
    await expect(stopUsageStats()).resolves.toBe(0);
  });

  it('komut adi olmadan kayit sessizce atlanir', () => {
    recordCommandUsage({ guildId: '1', ok: true });
    expect(usageBufferSize()).toBe(0);
  });
});
