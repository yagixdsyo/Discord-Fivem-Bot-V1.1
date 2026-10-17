/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';

describe('veri-yedegi', () => {
  it('reply cagrisi V2 kart + dosya eki icerir, content string degil', async () => {
    const calls = [];
    const ctx = {
      t: (key) => key,
      db: { ready: true },
      guild: { id: 'g1' },
      reply: async (payload) => {
        calls.push(payload);
      },
    };
    const command = (await import('../src/modules/analitik/commands/veri-yedegi.js')).default;
    await command.run(ctx);

    expect(calls).toHaveLength(1);
    const payload = calls[0];
    expect(Array.isArray(payload.files)).toBe(true);
    expect(payload.files).toHaveLength(1);
    expect(Array.isArray(payload.components)).toBe(true);
    expect(payload.components.length).toBeGreaterThan(0);
    expect(payload.content).toBeUndefined();
  });

  it('db hazir degilse hata karti gonderir', async () => {
    const calls = [];
    const ctx = {
      t: (key) => key,
      db: { ready: false },
      guild: { id: 'g1' },
      reply: async (payload) => {
        calls.push(payload);
      },
    };
    const command = (await import('../src/modules/analitik/commands/veri-yedegi.js')).default;
    await command.run(ctx);

    expect(calls).toHaveLength(1);
    expect(calls[0].files).toBeUndefined();
    expect(calls[0].components.length).toBeGreaterThan(0);
  });
});
