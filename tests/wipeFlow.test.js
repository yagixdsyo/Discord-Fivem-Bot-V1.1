/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it, vi } from 'vitest';
import { Collection } from 'discord.js';
import { createTranslator } from '../src/locales/index.js';

const { fakeStore } = vi.hoisted(() => ({
  fakeStore: {
    async getMap() {
      return [];
    },
    async setMap() {
      return true;
    },
    async deleteAllMaps() {
      return true;
    },
    async setSetting() {
      return true;
    },
    async markSetupDone() {
      return true;
    },
    async invalidateGuild() {},
  },
}));

vi.mock('../src/modules/setup/lib/store.js', () => ({
  createDbStore: () => fakeStore,
  MAP_COLLECTIONS: ['channels_map', 'roles_map', 'panel_messages'],
}));

function wipeGuild() {
  const channels = new Collection();
  const makeChannel = (id, type = 0) => {
    const channel = {
      id,
      type,
      name: id,
      async delete() {
        channels.delete(id);
      },
    };
    channels.set(id, channel);
    return channel;
  };
  makeChannel('owner-ch');
  makeChannel('komut-ch');
  makeChannel('c-extra');
  makeChannel('cat-1', 4);

  const roles = new Collection();
  roles.set('r1', {
    id: 'r1',
    name: 'rol1',
    position: 1,
    managed: false,
    async delete() {
      roles.delete('r1');
    },
  });

  return {
    id: 'g1',
    name: 'Test',
    ownerId: 'u1',
    channels: { cache: channels, fetch: vi.fn(async () => null) },
    roles: { cache: roles },
    members: { me: { roles: { highest: { position: 100 } } } },
  };
}

function fakeCtx(guild, decision) {
  const message = {
    edit: vi.fn(async () => true),
    awaitMessageComponent: vi.fn(async () => decision),
  };
  return {
    t: createTranslator(),
    db: { ready: true },
    user: { id: 'u1' },
    guild,
    config: { ownerLog: { channelId: 'owner-ch' } },
    interaction: { channelId: 'komut-ch' },
    args: { kanal: null },
    reply: vi.fn(async () => message),
    message,
  };
}

describe('/sistem-sil', () => {
  it('onayla: owner + komut kanali kalir; diger kanal/kategori/roller silinir', async () => {
    const mod = await import('../src/modules/setup/commands/sistemsil.js');
    const guild = wipeGuild();
    const decision = { customId: 'sistemsil:onay:u1', update: vi.fn(async () => true) };
    const ctx = fakeCtx(guild, decision);

    await mod.default.run(ctx);

    expect(guild.channels.cache.has('owner-ch')).toBe(true);
    expect(guild.channels.cache.has('komut-ch')).toBe(true);
    expect(guild.channels.cache.has('c-extra')).toBe(false);
    expect(guild.channels.cache.has('cat-1')).toBe(false);
    expect(guild.roles.cache.size).toBe(0);

    const lastEdit = ctx.message.edit.mock.calls.at(-1)[0];
    const json = JSON.stringify(lastEdit);
    expect(json).toContain('Silinen');
    expect(json).toContain('Korunan');
  });

  it('kanal argumani ek kanali korur', async () => {
    const mod = await import('../src/modules/setup/commands/sistemsil.js');
    const guild = wipeGuild();
    const decision = { customId: 'sistemsil:onay:u1', update: vi.fn(async () => true) };
    const ctx = fakeCtx(guild, decision);
    ctx.args.kanal = { id: 'c-extra' };

    await mod.default.run(ctx);

    expect(guild.channels.cache.has('c-extra')).toBe(true);
    expect(guild.channels.cache.has('cat-1')).toBe(false);
    expect(guild.channels.cache.has('owner-ch')).toBe(true);
  });

  it('iptal: hicbir sey silinmez', async () => {
    const mod = await import('../src/modules/setup/commands/sistemsil.js');
    const guild = wipeGuild();
    const decision = { customId: 'sistemsil:iptal:u1', update: vi.fn(async () => true) };
    const ctx = fakeCtx(guild, decision);

    await mod.default.run(ctx);

    expect(guild.channels.cache.size).toBe(4);
    expect(guild.roles.cache.size).toBe(1);
    expect(decision.update).toHaveBeenCalled();
  });

  it('zaman asimi (karar yok): hicbir sey silinmez, kart devre disi birakilir', async () => {
    const mod = await import('../src/modules/setup/commands/sistemsil.js');
    const guild = wipeGuild();
    const ctx = fakeCtx(guild, null);

    await mod.default.run(ctx);

    expect(guild.channels.cache.size).toBe(4);
    expect(guild.roles.cache.size).toBe(1);
    expect(ctx.message.edit).toHaveBeenCalled();
  });
});
