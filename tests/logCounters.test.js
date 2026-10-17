/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { afterEach, describe, expect, it } from 'vitest';
import { flushCounters, incLogCounter, readCounters, resetCounters } from '../src/modules/logging/lib/counters.js';
import { isLogChannelEnabled, setLogChannelEnabled } from '../src/modules/logging/lib/state.js';

const GUILD = '666666666666666666';

describe('sayaçlar', () => {
  it('artis -> okuma -> sifirlama dongusu', async () => {
    await incLogCounter(GUILD, 'log_ban');
    await incLogCounter(GUILD, 'log_ban');
    await incLogCounter(GUILD, 'log_kick');

    let rows = await readCounters(GUILD);
    expect(rows.get('log_ban')?.total).toBe(2);
    expect(rows.get('log_kick')?.total).toBe(1);
    expect(rows.get('log_ban')?.lastAt).toBeGreaterThan(0);

    const touched = await resetCounters(GUILD, ['log_ban']);
    expect(touched).toBeGreaterThan(0);

    rows = await readCounters(GUILD);
    expect(rows.get('log_ban')).toBeUndefined();
    expect(rows.get('log_kick')?.total).toBe(1);

    await resetCounters(GUILD, null);
    rows = await readCounters(GUILD);
    expect(rows.get('log_kick')).toBeUndefined();
  });

  it('flushCounters DB yokken hata firlatmaz', async () => {
    await incLogCounter(GUILD, 'log_ban');
    await expect(flushCounters([GUILD])).resolves.toBeUndefined();
  });
});

describe('kanal durumu', () => {
  it('DB yokken kanallar varsayilan acik', async () => {
    expect(await isLogChannelEnabled(GUILD, 'log_ban')).toBe(true);
  });

  it('setLogChannelEnabled DB yokken false doner', async () => {
    expect(await setLogChannelEnabled(GUILD, 'log_ban', false)).toBe(false);
  });
});
