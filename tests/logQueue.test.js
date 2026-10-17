/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  QUEUE_CONFIG,
  clearMemoryQueues,
  enqueueLog,
  getQueueLength,
  hydrateFiles,
} from '../src/modules/logging/lib/queue.js';

const CHANNEL = '555555555555555555';

afterEach(() => {
  clearMemoryQueues();
});

describe('enqueueLog', () => {
  it('kayitlari kanal kuyruguna ekler ve uzunlugu artar', async () => {
    expect(await getQueueLength(CHANNEL)).toBe(0);
    await enqueueLog({ channelId: CHANNEL, key: 'log_ban', entry: { at: Date.now() } });
    await enqueueLog({ channelId: CHANNEL, key: 'log_kick', entry: { at: Date.now() } });
    expect(await getQueueLength(CHANNEL)).toBe(2);
  });

  it('channelId yoksa kayit almaz', async () => {
    expect(await enqueueLog({ key: 'log_ban' })).toBe(false);
  });

  it('kuyruk kapasitesi asilinca en eski kayitlar dusurulur', async () => {
    const small = QUEUE_CONFIG.QUEUE_CAP + 5;
    for (let i = 0; i < small; i += 1) {
      await enqueueLog({ channelId: 'kanal-cap', key: 'log_ban', entry: { sira: i } });
    }
    expect(await getQueueLength('kanal-cap')).toBe(QUEUE_CONFIG.QUEUE_CAP);
  });
});

describe('hydrateFiles', () => {
  it('base64 dosya tanimini AttachmentBuilder\'a cevirir', async () => {
    const entry = {
      files: [{ name: 'test.html', data: Buffer.from('<b>merhaba</b>').toString('base64') }],
    };
    const hydrated = await hydrateFiles(entry);
    expect(hydrated.files).toHaveLength(1);
    expect(hydrated.files[0].name).toBe('test.html');
  });

  it('dosya yoksa giris aynen doner', async () => {
    const entry = { lines: ['a'] };
    expect(await hydrateFiles(entry)).toBe(entry);
  });
});

describe('QUEUE_CONFIG', () => {
  it('rate limit korumasi esikleri makul', () => {
    expect(QUEUE_CONFIG.RATE_MS).toBeGreaterThanOrEqual(1000);
    expect(QUEUE_CONFIG.BATCH_MAX).toBeGreaterThanOrEqual(2);
    expect(QUEUE_CONFIG.MAX_ATTEMPTS).toBeGreaterThanOrEqual(2);
  });
});
