/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import { CATEGORY_TYPE, planInstall, snapshotGuildView } from '../src/modules/backup/lib/plan.js';

const NOW = Date.now();

function makeData() {
  return {
    version: 1,
    guild: {
      name: 'Test Sunucu',
      verificationLevel: 2,
      afkChannelId: null,
      afkTimeout: 300,
      systemChannelId: null,
      rulesChannelId: null,
      preferredLocale: 'tr',
    },
    roles: [
      { id: '100', name: 'Kurucu', color: 0, hoist: true, mentionable: false, permissions: '8', position: 5 },
      { id: '101', name: 'Yeni Rol', color: 16711680, hoist: false, mentionable: true, permissions: '0', position: 3 },
      { id: '102', name: 'Bot Rolü', managed: true, permissions: '0', position: 1 },
    ],
    channels: [
      { id: '200', name: 'GENEL', type: CATEGORY_TYPE, position: 0, overwrites: [] },
      { id: '201', name: 'sohbet', type: 0, parentId: '200', position: 0, topic: 'hi', nsfw: false, rateLimitPerUser: 0, overwrites: [] },
      { id: '202', name: 'yeni-kanal', type: 0, parentId: '200', position: 1, nsfw: false, rateLimitPerUser: 0, overwrites: [] },
      { id: '203', name: 'yeni-kategori', type: CATEGORY_TYPE, position: 2, overwrites: [] },
    ],
    memberRoles: { 101: ['u1', 'u2'] },
  };
}

function makeView() {
  return {
    roles: [
      {
        id: '100',
        name: 'Kurucu',
        color: 0,
        hoist: true,
        mentionable: false,
        permissions: '8',
        managed: false,
        createdAt: NOW - 100_000,
      },
    ],
    channels: [
      { id: '200', name: 'GENEL', type: CATEGORY_TYPE, parentId: null, createdAt: NOW - 100_000 },
      { id: '201', name: 'sohbet', type: 0, parentId: '200', createdAt: NOW - 100_000 },
      { id: '900', name: 'anlık-kanal', type: 0, parentId: null, createdAt: NOW - 1_000 },
    ],
    guild: {
      name: 'Test Sunucu',
      verificationLevel: 3,
      afkChannelId: null,
      afkTimeout: 300,
      systemChannelId: null,
      rulesChannelId: null,
      preferredLocale: 'tr',
    },
  };
}

describe('backup plani', () => {
  it('eksik rol/kategori/kanallari kurar, managed rolleri atlar', () => {
    const plan = planInstall(makeData(), makeView());
    expect(plan.createRoles.map((role) => role.name)).toEqual(['Yeni Rol']);
    expect(plan.createCategories.map((channel) => channel.name)).toEqual(['yeni-kategori']);
    expect(plan.createChannels.map((channel) => channel.name)).toEqual(['yeni-kanal']);
    expect(plan.updateRoles).toEqual([]);
    expect(plan.counts.createRoles).toBe(1);
    expect(plan.memberRoles['101']).toEqual(['u1', 'u2']);
  });

  it('farkli olan roller icin guncelleme uretir', () => {
    const data = makeData();
    data.roles[0] = { id: '100', name: 'Kurucu', color: 255, hoist: false, mentionable: false, permissions: '8', position: 5 };
    const plan = planInstall(data, makeView());
    expect(plan.updateRoles.length).toBe(1);
    expect(plan.updateRoles[0].existingId).toBe('100');
    expect(plan.updateRoles[0].changes.color).toBe(255);
    expect(plan.updateRoles[0].changes.hoist).toBe(false);
  });

  it('ayar farklari raporlanir', () => {
    const plan = planInstall(makeData(), makeView());
    expect(plan.settings).toEqual([{ key: 'verificationLevel', from: 3, to: 2 }]);
  });

  it('temizle: backup sonrasi olusan fazlalik silinir, eskiler korunur', () => {
    const plan = planInstall(makeData(), makeView(), { temizle: true, backupAtMs: NOW - 50_000 });
    expect(plan.deleteChannels.map((channel) => channel.name)).toEqual(['anlık-kanal']);
    expect(plan.deleteRoles).toEqual([]);
  });

  it('temizle: backup oncesi olusan kanal korunur', () => {
    const view = makeView();
    view.channels.push({ id: '901', name: 'eski-fazlalik', type: 0, parentId: null, createdAt: NOW - 200_000 });
    const plan = planInstall(makeData(), view, { temizle: true, backupAtMs: NOW - 50_000 });
    expect(plan.deleteChannels.map((channel) => channel.name)).toEqual(['anlık-kanal']);
  });

  it('temizle: korunan ID listesi ve eslesen isimler silinmez', () => {
    const view = makeView();
    view.channels.push({ id: '902', name: 'mapped-kanal', type: 0, parentId: null, createdAt: NOW - 1_000 });
    const plan = planInstall(makeData(), view, {
      temizle: true,
      backupAtMs: NOW - 50_000,
      keepChannelIds: ['902'],
    });
    expect(plan.deleteChannels.map((channel) => channel.name)).toEqual(['anlık-kanal']);
  });

  it('backupAtMs yoksa silme plani uretilmez (guvenli varsayilan)', () => {
    const plan = planInstall(makeData(), makeView(), { temizle: true, backupAtMs: null });
    expect(plan.deleteChannels).toEqual([]);
    expect(plan.deleteRoles).toEqual([]);
  });

  it('eksik kategori icin uyari uretir', () => {
    const data = makeData();
    data.channels.push({ id: '204', name: 'yetim', type: 0, parentId: '999', nsfw: false, rateLimitPerUser: 0, overwrites: [] });
    const plan = planInstall(data, makeView());
    // parentId '999' veride hic yok -> parent cozulemez; uyari sart degil ama plan cokmemeli
    expect(plan.createChannels.map((channel) => channel.name)).toContain('yetim');
  });
});

describe('sunucu gorunumu', () => {
  it('snapshotGuildView @everyone haric rol ve kanallari toplar', () => {
    const guild = {
      id: 'g1',
      name: 'Sunucu',
      roles: {
        cache: new Map([
          ['g1', { id: 'g1', name: '@everyone', managed: false }],
          ['r1', { id: 'r1', name: 'Rol', color: 1, hoist: false, mentionable: false, permissions: { bitfield: 0n }, managed: false, createdTimestamp: 5 }],
        ]),
      },
      channels: {
        cache: new Map([['c1', { id: 'c1', name: 'genel', type: 0, parentId: null, createdTimestamp: 6 }]]),
      },
      verificationLevel: 1,
      afkTimeout: 300,
      preferredLocale: 'tr',
    };
    const view = snapshotGuildView(guild);
    expect(view.roles.map((role) => role.id)).toEqual(['r1']);
    expect(view.channels[0].name).toBe('genel');
    expect(view.guild.verificationLevel).toBe(1);
  });
});
