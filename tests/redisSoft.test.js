/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import {
  initRedis,
  isRedisReady,
  closeRedis,
  setJSON,
  getJSON,
  delKey,
  cached,
  getRedis,
} from '../src/core/redis.js';
import { startAnnounceWorker } from '../src/modules/announce/lib/dmQueue.js';

describe('redis - yumusak mod', () => {
  it('redis baslatilmadan JSON yardimcilari guvenli no-op doner', async () => {
    expect(isRedisReady()).toBe(false);
    expect(await getJSON('yok')).toBeNull();
    expect(await setJSON('yok', { a: 1 })).toBeNull();
    expect(await delKey('yok')).toBe(0);
    const value = await cached('k', 60, async () => 'uretilen');
    expect(value).toBe('uretilen'); // onbellek yok: uretici calisir, yazma atlanir
  });

  it('erisilemeyen Redis ile initRedis hata firlatmaz; null doner', async () => {
    const result = await initRedis({ url: 'redis://127.0.0.1:1', timeoutMs: 400 });
    expect(result).toBeNull();
    expect(isRedisReady()).toBe(false);
    await closeRedis();
  });

  it('Redis yokken DM duyuru kuyrugu baslatilmaz; surec ici gonderim kullanilir', async () => {
    const started = await startAnnounceWorker({ url: 'redis://127.0.0.1:6379' });
    expect(started).toBe(false);
  });

  it('Redis yoksa getRedis() hala acik hata firlatir (koruma bozulmadi)', () => {
    expect(() => getRedis()).toThrow(/Redis hazir degil/);
  });
});
