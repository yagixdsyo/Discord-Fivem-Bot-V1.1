/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';

vi.mock('../src/core/guildSettings.js', () => ({
  getGuildConfig: vi.fn(async () => ({ settings: {} })),
  setGuildSetting: vi.fn(async () => true),
}));

import { getGuildConfig, setGuildSetting } from '../src/core/guildSettings.js';
import { createTranslator } from '../src/locales/index.js';
import {
  canGrantRole,
  canRemoveRole,
  grantRole,
  revokeRole,
  bulkRole,
  getRoleLimits,
  setRoleLimits,
  roleErrorCard,
} from '../src/modules/moderation/lib/roles.js';
import { clearModerationMemory, listRoleLogs } from '../src/modules/moderation/lib/store.js';
import { clearSanctionMemory } from '../src/modules/guard/lib/sanction.js';

const t = createTranslator('tr');

function fakeRole({ id = 'r1', position = 5, managed = false, bitfield = 0n } = {}) {
  return { id, name: 'TestRol', position, managed, permissions: { bitfield } };
}

function fakeTarget({ id = 'm1', highest = 1, roleIds = [] } = {}) {
  const cache = new Map(roleIds.map((rid) => [rid, { id: rid }]));
  return {
    id,
    roles: {
      highest: { position: highest },
      cache,
      add: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    },
  };
}

function fakeGuild({ id = 'g1', ownerId = 'owner', roles = [], members = [] } = {}) {
  return {
    id,
    ownerId,
    roles: { cache: new Map(roles.map((role) => [role.id, role])) },
    members: {
      cache: new Map(members.map((member) => [member.id, member])),
      fetch: async () => {
        throw new Error('fetch yok (test)');
      },
    },
  };
}

beforeEach(() => {
  clearModerationMemory();
  clearSanctionMemory();
  getGuildConfig.mockReset();
  getGuildConfig.mockResolvedValue({ settings: {} });
  setGuildSetting.mockReset();
  setGuildSetting.mockResolvedValue(true);
});

describe('roles/canGrantRole', () => {
  it('rol null / ayni sunucu rolu / managed reddedilir', async () => {
    const guild = fakeGuild({ roles: [] });
    const actor = fakeTarget({ id: 'a1', highest: 10 });
    const bot = fakeTarget({ id: 'b1', highest: 10 });

    expect(await canGrantRole({ guild, actorMember: actor, botMember: bot, role: null })).toMatchObject({ ok: false, reason: 'rol_yok' });

    const everyoneRole = fakeRole({ id: 'g1', position: 0 });
    expect(await canGrantRole({ guild: fakeGuild({ roles: [everyoneRole] }), actorMember: actor, botMember: bot, role: everyoneRole })).toMatchObject({ ok: false, reason: 'everyone' });

    const managed = fakeRole({ managed: true });
    expect(await canGrantRole({ guild: fakeGuild({ roles: [managed] }), actorMember: actor, botMember: bot, role: managed })).toMatchObject({ ok: false, reason: 'managed' });
  });

  it('bot ve aktor hiyerarsisi kontrol edilir', async () => {
    const role = fakeRole({ position: 5 });
    const guild = fakeGuild({ roles: [role] });

    const lowBot = fakeTarget({ id: 'b1', highest: 5 });
    expect(await canGrantRole({ guild, actorMember: fakeTarget({ highest: 10 }), botMember: lowBot, role })).toMatchObject({ ok: false, reason: 'bot_konum' });

    const bot = fakeTarget({ id: 'b1', highest: 10 });
    const lowActor = fakeTarget({ id: 'a1', highest: 5 });
    expect(await canGrantRole({ guild, actorMember: lowActor, botMember: bot, role })).toMatchObject({ ok: false, reason: 'aktorden_yuksek' });
  });

  it('sunucu sahibi aktor hiyerarsiye takilmaz', async () => {
    const role = fakeRole({ position: 50 });
    const guild = fakeGuild({ roles: [role], ownerId: 'owner' });
    const actor = fakeTarget({ id: 'owner', highest: 0 });
    const bot = fakeTarget({ id: 'b1', highest: 60 });

    expect(await canGrantRole({ guild, actorMember: actor, botMember: bot, role })).toEqual({ ok: true });
  });

  it('tehlikeli izinli rol sinir tablosu olmadan verilemez', async () => {
    const role = fakeRole({ bitfield: PermissionFlagsBits.ManageRoles });
    const guild = fakeGuild({ roles: [role] });
    const actor = fakeTarget({ id: 'a1', highest: 10 });
    const bot = fakeTarget({ id: 'b1', highest: 10 });

    expect(await canGrantRole({ guild, actorMember: actor, botMember: bot, role })).toMatchObject({
      ok: false,
      reason: 'tehlikeli_kisitli',
    });
  });

  it('sinir tablosu aktoru kapsiyorsa tehlikeli rol verilebilir', async () => {
    const role = fakeRole({ bitfield: PermissionFlagsBits.ManageRoles });
    const guild = fakeGuild({ roles: [role] });
    const actor = fakeTarget({ id: 'a1', highest: 10 });
    const bot = fakeTarget({ id: 'b1', highest: 10 });

    getGuildConfig.mockResolvedValueOnce({
      settings: { 'roles.limits': [{ user_id: 'a1', target_role_ids: ['r1'] }] },
    });

    expect(await canGrantRole({ guild, actorMember: actor, botMember: bot, role })).toEqual({ ok: true });
  });

  it('canRemoveRole tehlikeli izin kisiti uygulamaz', async () => {
    const role = fakeRole({ bitfield: PermissionFlagsBits.ManageRoles });
    const guild = fakeGuild({ roles: [role] });
    const actor = fakeTarget({ id: 'a1', highest: 10 });
    const bot = fakeTarget({ id: 'b1', highest: 10 });

    expect(await canRemoveRole({ guild, actorMember: actor, botMember: bot, role })).toEqual({ ok: true });
  });
});

describe('roles/grantRole + revokeRole', () => {
  it('rol verir, guard isareti koyar ve rol logu yazar', async () => {
    const role = fakeRole();
    const guild = fakeGuild({ roles: [role] });
    const actor = fakeTarget({ id: 'a1', highest: 10 });
    const bot = fakeTarget({ id: 'b1', highest: 10 });
    const target = fakeTarget({ id: 'm1', highest: 1 });

    const result = await grantRole({ guild, actorMember: actor, botMember: bot, targetMember: target, role, actorId: 'a1' });
    expect(result.ok).toBe(true);
    expect(target.roles.add).toHaveBeenCalledWith('r1', expect.any(String));

    const logs = await listRoleLogs('g1', { userId: 'm1' });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ role_id: 'r1', action: 'ekle', actor_id: 'a1', via: 'komut' });
  });

  it('rol alir ve log yazar', async () => {
    const role = fakeRole();
    const guild = fakeGuild({ roles: [role] });
    const actor = fakeTarget({ id: 'a1', highest: 10 });
    const bot = fakeTarget({ id: 'b1', highest: 10 });
    const target = fakeTarget({ id: 'm1', highest: 1 });

    const result = await revokeRole({ guild, actorMember: actor, botMember: bot, targetMember: target, role, actorId: 'a1' });
    expect(result.ok).toBe(true);
    expect(target.roles.remove).toHaveBeenCalledWith('r1', expect.any(String));

    const logs = await listRoleLogs('g1', { userId: 'm1' });
    expect(logs[0].action).toBe('cikar');
  });
});

describe('roles/bulkRole', () => {
  it('ok/atlanan/yok sonuclarini ayirir', async () => {
    const role = fakeRole();
    const m1 = fakeTarget({ id: 'm1' });
    const m2 = fakeTarget({ id: 'm2', roleIds: ['r1'] });
    const guild = fakeGuild({ roles: [role], members: [m1, m2] });
    const actor = fakeTarget({ id: 'a1', highest: 10 });
    const bot = fakeTarget({ id: 'b1', highest: 10 });

    const result = await bulkRole({
      guild,
      actorMember: actor,
      botMember: bot,
      role,
      userIds: ['m1', 'm2', 'yok1'],
      action: 'ekle',
      delayMs: 0,
    });

    expect(result.ok).toEqual(['m1']);
    expect(result.atlanan).toEqual(['m2']);
    expect(result.yok).toEqual(['yok1']);
    expect(result.hata).toEqual([]);
  });

  it('izin reddedilirse hata dondurup islem yapmaz', async () => {
    const role = fakeRole({ position: 50 });
    const guild = fakeGuild({ roles: [role] });
    const actor = fakeTarget({ id: 'a1', highest: 10 });
    const bot = fakeTarget({ id: 'b1', highest: 10 });

    const result = await bulkRole({ guild, actorMember: actor, botMember: bot, role, userIds: ['m1'], action: 'ekle', delayMs: 0 });
    expect(result.ok).toEqual([]);
    expect(result.hata[0].error).toBe('bot_konum');
  });
});

describe('roles/limits + roleErrorCard', () => {
  it('sinir tablosu kaydedilir', async () => {
    await setRoleLimits('g1', [{ user_id: 'a1', target_role_ids: ['r1'] }]);
    expect(setGuildSetting).toHaveBeenCalledWith('g1', 'roles.limits', [{ user_id: 'a1', target_role_ids: ['r1'] }]);
  });

  it('getRoleLimits dizi olmayani bos dizi yapar', async () => {
    getGuildConfig.mockResolvedValueOnce({ settings: { 'roles.limits': 'bozuk' } });
    expect(await getRoleLimits('g1')).toEqual([]);
  });

  it('roleErrorCard yerellestirilmis hata karti uretir', () => {
    const card = roleErrorCard(t, 'bot_konum');
    const json = JSON.stringify(card);
    expect(json).toContain('Rol işlemi reddedildi');
    expect(json).toContain('rol botun rolünün üstünde');
  });
});
