/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clearSetupPanels,
  postRegisteredPanels,
  registerSetupPanel,
} from '../src/modules/setup/lib/panels.js';

beforeEach(() => {
  clearSetupPanels();
});

function fakeGuild() {
  const message = { id: 'm1' };
  const channel = {
    id: 'ch1',
    messages: { fetch: vi.fn(async () => null) },
    send: vi.fn(async () => message),
  };
  const guild = {
    id: 'g1',
    name: 'Test Sunucu',
    channels: {
      cache: new Map([['ch1', channel]]),
      fetch: vi.fn(async () => channel),
    },
  };
  return { guild, channel, message };
}

function fakeStore(panelDocs = []) {
  return {
    getMap: vi.fn(async (collection) => {
      if (collection === 'panel_messages') return panelDocs;
      if (collection === 'channels_map') return [{ key: 'panel_test', channel_id: 'ch1' }];
      return [];
    }),
    setMap: vi.fn(async () => {}),
  };
}

describe('postRegisteredPanels', () => {
  it('kanal eslesmesi olan paneli gonderir, kaydeder ve afterPost cagirir', async () => {
    const afterPost = vi.fn(async () => {});
    registerSetupPanel({
      key: 'panel_test',
      channelKey: 'panel_test',
      build: async () => ({ components: [] }),
      afterPost,
    });
    const { guild, channel, message } = fakeGuild();
    const store = fakeStore();

    const result = await postRegisteredPanels(guild, { store });

    expect(result.posted).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(afterPost).toHaveBeenCalledWith({ guild, channel, message, store });
    expect(store.setMap).toHaveBeenCalledWith(
      'panel_messages',
      expect.objectContaining({ key: 'panel_test', message_id: 'm1', channel_id: 'ch1' }),
    );
  });

  it('mesaj duruyorsa atlar ve afterPost cagirmaz', async () => {
    const afterPost = vi.fn(async () => {});
    registerSetupPanel({
      key: 'panel_test',
      channelKey: 'panel_test',
      build: async () => ({ components: [] }),
      afterPost,
    });
    const { guild, channel } = fakeGuild();
    channel.messages.fetch = vi.fn(async () => ({ id: 'm1' }));
    const store = fakeStore([{ key: 'panel_test', message_id: 'm1' }]);

    const result = await postRegisteredPanels(guild, { store });

    expect(result.posted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(channel.send).not.toHaveBeenCalled();
    expect(afterPost).not.toHaveBeenCalled();
  });

  it('kanal eslemesi yoksa atlar (paket kurulmamis)', async () => {
    registerSetupPanel({ key: 'panel_test', channelKey: 'panel_test', build: async () => ({ components: [] }) });
    const { guild } = fakeGuild();
    const store = { getMap: vi.fn(async () => []), setMap: vi.fn(async () => {}) };

    const result = await postRegisteredPanels(guild, { store });

    expect(result.posted).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('afterPost hatasi panel yayinini bozmaz; errors listesine yazilir', async () => {
    registerSetupPanel({
      key: 'panel_test',
      channelKey: 'panel_test',
      build: async () => ({ components: [] }),
      afterPost: async () => {
        throw new Error('ayar yazilamadi');
      },
    });
    const { guild } = fakeGuild();

    const result = await postRegisteredPanels(guild, { store: fakeStore() });

    expect(result.posted).toBe(1);
    expect(result.errors).toEqual([{ key: 'panel_test', error: 'ayar yazilamadi' }]);
  });
});
