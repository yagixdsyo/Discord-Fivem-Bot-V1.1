/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { afterEach, describe, expect, it } from 'vitest';
import { clearRateMemory, hitLimit, resetLimit } from '../src/modules/guard/lib/rate.js';

afterEach(() => clearRateMemory());

describe('guard esik sayaci', () => {
  it('limit 1 iken ilk olay esik asar', async () => {
    const result = await hitLimit({ guildId: 'g1', module: 'rol', actorId: 'u1', limit: 1, windowSec: 10 });
    expect(result.count).toBe(1);
    expect(result.exceeded).toBe(true);
    expect(result.limit).toBe(1);
  });

  it('limit 4 iken dorduncu olayda esik asar', async () => {
    const opts = { guildId: 'g1', module: 'ban_kick', actorId: 'u2', limit: 4, windowSec: 60 };
    expect((await hitLimit(opts)).exceeded).toBe(false);
    expect((await hitLimit(opts)).exceeded).toBe(false);
    expect((await hitLimit(opts)).exceeded).toBe(false);
    const fourth = await hitLimit(opts);
    expect(fourth.count).toBe(4);
    expect(fourth.exceeded).toBe(true);
  });

  it('farkli aktorler birbirinden bagimsiz sayilir', async () => {
    const base = { guildId: 'g1', module: 'rol', limit: 2, windowSec: 10 };
    expect((await hitLimit({ ...base, actorId: 'a' })).count).toBe(1);
    expect((await hitLimit({ ...base, actorId: 'b' })).count).toBe(1);
    expect((await hitLimit({ ...base, actorId: 'a' })).count).toBe(2);
  });

  it('farkli moduller birbirinden bagimsiz sayilir', async () => {
    const base = { guildId: 'g1', actorId: 'u3', limit: 5, windowSec: 10 };
    expect((await hitLimit({ ...base, module: 'rol' })).count).toBe(1);
    expect((await hitLimit({ ...base, module: 'kanal' })).count).toBe(1);
  });

  it('resetLimit pencereyi sifirlar', async () => {
    const opts = { guildId: 'g1', module: 'rol', actorId: 'u4', limit: 3, windowSec: 10 };
    await hitLimit(opts);
    await hitLimit(opts);
    await resetLimit(opts);
    const result = await hitLimit(opts);
    expect(result.count).toBe(1);
    expect(result.exceeded).toBe(false);
  });

  it('gecersiz limit 1 kabul edilir', async () => {
    const result = await hitLimit({ guildId: 'g1', module: 'rol', actorId: 'u5', limit: 0, windowSec: 0 });
    expect(result.limit).toBe(1);
    expect(result.exceeded).toBe(true);
  });
});
