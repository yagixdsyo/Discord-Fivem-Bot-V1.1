/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { settingsStore } = vi.hoisted(() => ({ settingsStore: new Map() }));

vi.mock('../src/core/guildSettings.js', () => ({
  getGuildConfig: vi.fn(async (guildId) => ({ settings: settingsStore.get(guildId) ?? {} })),
  setGuildSetting: vi.fn(async (guildId, key, value) => {
    const settings = settingsStore.get(guildId) ?? {};
    settings[key] = value;
    settingsStore.set(guildId, settings);
    return true;
  }),
  invalidateGuildConfig: vi.fn(async () => {}),
}));

vi.mock('../src/modules/fivem/lib/maps.js', () => ({
  getChannelId: vi.fn(async () => null),
  getRoleId: vi.fn(async () => null),
  resolveChannel: vi.fn(async () => null),
  resolveRole: vi.fn(async () => null),
  clearMapsCache: vi.fn(),
}));

import { createTranslator } from '../src/locales/index.js';
import { clearSanctionMemory } from '../src/modules/guard/lib/sanction.js';
import { clearFivemMemory } from '../src/modules/fivem/lib/store.js';
import { getByUser, updateRegistrationName } from '../src/modules/fivem/lib/registration.js';
import { getRoleId } from '../src/modules/fivem/lib/maps.js';
import { registerMember } from '../src/modules/fivem/lib/kayitFlow.js';

const t = createTranslator('tr');

const ROLE_IDS = { kayitli: 'r-kayitli', kayitsiz: 'r-kayitsiz', blacklist: 'r-black' };

function fakeMember({ id = 'm1', roles = [], accountDays = 365, username = 'hedef' } = {}) {
  const cache = new Map(roles.map((roleId) => [roleId, true]));
  return {
    id,
    user: { id, username, createdTimestamp: Date.now() - accountDays * 86_400_000 },
    roles: {
      cache,
      add: vi.fn(async (roleId) => {
        cache.set(roleId, true);
      }),
      remove: vi.fn(async (roleId) => {
        cache.delete(roleId);
      }),
    },
    setNickname: vi.fn(async () => {}),
  };
}

function fakeGuild({ id = 'g1', rolePosition = 5, botPosition = 50 } = {}) {
  const kayitliRole = { id: ROLE_IDS.kayitli, position: rolePosition };
  return {
    id,
    name: 'Test Sunucu',
    roles: {
      cache: new Map([[ROLE_IDS.kayitli, kayitliRole]]),
      fetch: vi.fn(async () => null),
    },
    members: { me: { roles: { highest: { position: botPosition } } } },
    channels: { cache: new Map(), fetch: vi.fn(async () => null) },
  };
}

beforeEach(() => {
  clearFivemMemory();
  clearSanctionMemory();
  settingsStore.clear();
  getRoleId.mockReset();
  getRoleId.mockImplementation(async (_guildId, key) => ROLE_IDS[key] ?? null);
});

describe('kayit isim guncelleme', () => {
  it('kayitli uyeye yeni isim verilirse nick ve kayit guncellenir', async () => {
    const guild = fakeGuild();
    const member = fakeMember({ roles: [ROLE_IDS.kayitsiz] });
    const actor = { id: 'a1' };

    const first = await registerMember(guild, { member, actor, icName: 'Ali Veli' });
    expect(first).toEqual({ ok: true });
    expect((await getByUser('g1', 'm1')).ic_name).toBe('Ali Veli');

    const second = await registerMember(guild, { member, actor, icName: 'Ahmet Yılmaz', oocName: 'ahmet' });
    expect(second.ok).toBe(true);
    expect(second.nameUpdated).toBe(true);
    expect(second.previous).toBe('Ali Veli');
    expect(member.setNickname).toHaveBeenLastCalledWith('Ahmet Yılmaz', 'Kayit ismi guncelle: a1');

    const fresh = await getByUser('g1', 'm1');
    expect(fresh.ic_name).toBe('Ahmet Yılmaz');
    expect(fresh.ooc_name).toBe('ahmet');
  });

  it('ayni isimle yeniden kayit yine zaten_kayitli doner', async () => {
    const guild = fakeGuild();
    const member = fakeMember();
    const actor = { id: 'a1' };
    await registerMember(guild, { member, actor, icName: 'Ali' });
    expect(await registerMember(guild, { member, actor, icName: 'Ali' })).toEqual({ ok: false, error: 'zaten_kayitli' });
  });

  it('updateRegistrationName kaydi gunceller', async () => {
    const guild = fakeGuild();
    const member = fakeMember();
    await registerMember(guild, { member, actor: { id: 'a1' }, icName: 'Eski İsim' });
    expect(await updateRegistrationName('g1', 'm1', { icName: 'Yeni İsim', oocName: 'ooc' })).toBe(true);
    const fresh = await getByUser('g1', 'm1');
    expect(fresh.ic_name).toBe('Yeni İsim');
    expect(fresh.ooc_name).toBe('ooc');
  });
});

describe('/kayit-rol komutu', () => {
  function makeCtx(args = {}) {
    const replies = [];
    const ctx = {
      t,
      db: { ready: true },
      args,
      user: { id: 'a1', username: 'yonetici' },
      guild: fakeGuild(),
      reply: async (payload) => replies.push(payload),
      followUp: async (payload) => replies.push(payload),
    };
    return { ctx, replies };
  }

  it('argumansiz cagri ayarlari gosterir', async () => {
    const mod = await import('../src/modules/fivem/commands/kayitrol.js');
    const { ctx, replies } = makeCtx({});
    await mod.default.run(ctx);
    const json = JSON.stringify(replies[0]);
    expect(json).toContain('Kayıt Rol Ayarları');
    expect(json).toContain('Ayarlı değil');
    expect(json).toContain('Katılım otorolü');
  });

  it('grevli islem sozdizimi kullaniciyi yonlendirir', async () => {
    const mod = await import('../src/modules/fivem/commands/kayitrol.js');
    const { ctx, replies } = makeCtx({ islem: 'bilinmeyen' });
    await mod.default.run(ctx);
    const json = JSON.stringify(replies[0]);
    expect(json).toContain('kaldir verilecek');
  });

  it('kaldir verilecek islemi basarili kart doner', async () => {
    const mod = await import('../src/modules/fivem/commands/kayitrol.js');
    const { ctx, replies } = makeCtx({ islem: 'kaldir verilecek' });
    await mod.default.run(ctx);
    const all = JSON.stringify(replies);
    expect(all).toContain('Kayıt Rolleri Güncellendi');
    expect(all).toContain('temizlendi');
  });

  it('komut tanimi kayit sistemi ve rol izinleri tasir', async () => {
    const mod = await import('../src/modules/fivem/commands/kayitrol.js');
    expect(mod.default.name).toBe('kayıt-rol');
    expect(mod.default.system).toBe('kayit');
    expect(mod.default.permission.discord).toContain('ManageRoles');
    expect(mod.default.args.map((a) => a.name)).toEqual(['verilecek', 'alinacak', 'otorol', 'islem']);
  });
});
