/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import { Collection } from 'discord.js';
import { runReset, runSetup } from '../src/modules/setup/lib/engine.js';
import { buildSetupPlan } from '../src/modules/setup/lib/plan.js';
import { evaluatePrecheck } from '../src/modules/setup/lib/precheck.js';

const GUILD_ID = '222222222222222222';

let seq = 0;
const nextId = (prefix) => `${prefix}${++seq}`;

function createFakeStore() {
  const maps = {
    channels_map: new Map(),
    roles_map: new Map(),
    panel_messages: new Map(),
  };
  const settings = new Map();
  const setupDone = new Map();
  return {
    maps,
    settings,
    setupDone,
    async getMap(collection, guildId) {
      return [...maps[collection].values()].filter((d) => d.guild_id === guildId);
    },
    async setMap(collection, doc) {
      maps[collection].set(`${doc.guild_id}:${doc.key}`, { ...doc });
      return true;
    },
    async deleteAllMaps(guildId) {
      for (const map of Object.values(maps)) {
        for (const [key, doc] of map) {
          if (doc.guild_id === guildId) map.delete(key);
        }
      }
    },
    async setSetting(guildId, key, value) {
      settings.set(`${guildId}:${key}`, value);
      return true;
    },
    async markSetupDone(guildId, value) {
      setupDone.set(guildId, value);
      return true;
    },
    async invalidateGuild() {},
  };
}

function createFakeGuild() {
  const roles = new Collection();
  const channels = new Collection();
  const roleManager = {
    cache: roles,
    setPositionCalls: 0,
    async create(options) {
      const role = {
        id: nextId('r'),
        name: options.name,
        position: 1,
        managed: false,
        async delete() {
          roles.delete(this.id);
        },
      };
      roles.set(role.id, role);
      return role;
    },
    async setPositions(pairs) {
      roleManager.setPositionCalls += 1;
      for (const pair of pairs) {
        if (pair.role) pair.role.position = pair.position;
      }
    },
    async fetch(id) {
      return roles.get(id) ?? null;
    },
    find(predicate) {
      return [...roles.values()].find(predicate) ?? null;
    },
  };
  const channelManager = {
    cache: channels,
    async fetch(id) {
      return channels.get(id) ?? null;
    },
    async create(options) {
      const channel = {
        id: nextId('c'),
        name: options.name,
        type: options.type,
        parentId: options.parent ?? null,
        async delete() {
          channels.delete(this.id);
        },
        async setParent(id) {
          this.parentId = id;
        },
      };
      channels.set(channel.id, channel);
      return channel;
    },
  };
  return {
    id: GUILD_ID,
    name: 'Test Sunucusu',
    roles: roleManager,
    channels: channelManager,
    members: { me: { roles: { highest: { position: 100 } } } },
  };
}

async function setupEverything() {
  const guild = createFakeGuild();
  const store = createFakeStore();
  const plan = buildSetupPlan({ packages: 'hepsi', options: { cfxCode: 'cfx123', otoRolId: '999' } });
  const first = await runSetup(guild, { plan, store });
  return { guild, store, plan, first };
}

describe('runSetup', () => {
  it('tum plani uygular; eslemeler, ayarlar ve setup_done yazilir', async () => {
    const { guild, store, plan, first } = await setupEverything();

    expect(first.errors).toEqual([]);
    expect(first.roles.created).toBe(plan.roles.length);
    expect(first.categories.created).toBe(plan.categories.length);
    expect(first.channels.created).toBe(plan.channels.length);
    expect(guild.roles.cache.size).toBe(plan.roles.length);
    expect(guild.channels.cache.size).toBe(plan.categories.length + plan.channels.length);

    const roleDocs = await store.getMap('roles_map', GUILD_ID);
    const channelDocs = await store.getMap('channels_map', GUILD_ID);
    expect(roleDocs.length).toBe(plan.roles.length);
    expect(channelDocs.length).toBe(plan.categories.length + plan.channels.length);

    expect(store.settings.get(`${GUILD_ID}:setup.packages`)).toEqual(['hepsi']);
    expect(store.settings.get(`${GUILD_ID}:setup.version`)).toBe(1);
    expect(store.settings.get(`${GUILD_ID}:fivem.cfx_code`)).toBe('cfx123');
    expect(store.settings.get(`${GUILD_ID}:roles.oto_rol`)).toBe('999');
    expect(store.setupDone.get(GUILD_ID)).toBe(true);

    // Roller botun en ust rolunun altina siralanir
    expect(guild.roles.setPositionCalls).toBe(1);
    const yonetici = roleDocs.find((d) => d.key === 'yonetici');
    expect(guild.roles.cache.get(yonetici.role_id).position).toBe(99);
  });

  it('ikinci calistirma idempotenttir: kopya olusmaz', async () => {
    const { guild, store, plan, first } = await setupEverything();
    const roleCount = guild.roles.cache.size;
    const channelCount = guild.channels.cache.size;

    const second = await runSetup(guild, { plan, store });

    expect(second.errors).toEqual([]);
    expect(second.roles.created).toBe(0);
    expect(second.roles.reused).toBe(plan.roles.length);
    expect(second.categories.created).toBe(0);
    expect(second.channels.created).toBe(0);
    expect(guild.roles.cache.size).toBe(roleCount);
    expect(guild.channels.cache.size).toBe(channelCount);
    expect((await store.getMap('roles_map', GUILD_ID)).length).toBe(roleCount);
    expect(second.roles.adopted).toBe(0);
    expect(first.roles.created).toBeGreaterThan(0);
    // Pozisyonlar zaten dogru: tekrar siralama cagrisi yapilmaz
    expect(guild.roles.setPositionCalls).toBe(1);
  });

  it('silinen rol yeniden olusturulur ve esleme guncellenir (onarim modu)', async () => {
    const { guild, store } = await setupEverything();
    const docsBefore = await store.getMap('roles_map', GUILD_ID);
    const destek = docsBefore.find((d) => d.key === 'destek');
    guild.roles.cache.delete(destek.role_id);

    const result = await runSetup(guild, { plan: buildSetupPlan({ packages: 'hepsi' }), store });

    expect(result.roles.created).toBe(1);
    const docsAfter = await store.getMap('roles_map', GUILD_ID);
    const newDestek = docsAfter.find((d) => d.key === 'destek');
    expect(newDestek.role_id).not.toBe(destek.role_id);
    expect(guild.roles.cache.get(newDestek.role_id).name).toBe('Destek');
  });

  it('silinen kanal yeniden olusturulur; kategori silinirse kanallar geri tasinir', async () => {
    const { guild, store } = await setupEverything();
    const channelDocs = await store.getMap('channels_map', GUILD_ID);
    const kurallar = channelDocs.find((d) => d.key === 'kurallar');
    guild.channels.cache.delete(kurallar.channel_id);

    const afterChannel = await runSetup(guild, { plan: buildSetupPlan({ packages: 'hepsi' }), store });
    expect(afterChannel.channels.created).toBe(1);
    const kurallarAfter = (await store.getMap('channels_map', GUILD_ID)).find((d) => d.key === 'kurallar');
    expect(kurallarAfter.channel_id).not.toBe(kurallar.channel_id);

    // Kategori silinince yeniden olusturulur ve kanallar yeni kategoriye tasinir
    const catBilgi = (await store.getMap('channels_map', GUILD_ID)).find((d) => d.key === 'cat_bilgi');
    guild.channels.cache.delete(catBilgi.channel_id);
    const afterCategory = await runSetup(guild, { plan: buildSetupPlan({ packages: 'hepsi' }), store });

    expect(afterCategory.categories.created).toBe(1);
    expect(afterCategory.channels.moved).toBeGreaterThan(0);
    const catAfter = (await store.getMap('channels_map', GUILD_ID)).find((d) => d.key === 'cat_bilgi');
    const kurallarFinal = (await store.getMap('channels_map', GUILD_ID)).find((d) => d.key === 'kurallar');
    expect(guild.channels.cache.get(kurallarFinal.channel_id).parentId).toBe(catAfter.channel_id);
  });

  it('ayni isimde var olan rol sahiplenilir, kopya olusturulmaz', async () => {
    const guild = createFakeGuild();
    const store = createFakeStore();
    const existing = await guild.roles.create({ name: 'Yetkili' });
    const plan = buildSetupPlan({ packages: ['ticket'] });

    const result = await runSetup(guild, { plan, store });

    expect(result.roles.adopted).toBe(1);
    expect(guild.roles.cache.size).toBe(plan.roles.length);
    const yetkiliDoc = (await store.getMap('roles_map', GUILD_ID)).find((d) => d.key === 'yetkili');
    expect(yetkiliDoc.role_id).toBe(existing.id);
  });
});

describe('runReset', () => {
  it('kurulum yapisini siler, eslemeleri ve setup_done temizler; veri koleksiyonlarina dokunmaz', async () => {
    const { guild, store, plan } = await setupEverything();
    const roleCount = guild.roles.cache.size;
    const channelCount = guild.channels.cache.size;
    store.settings.set(`${GUILD_ID}:kullanici.verisi`, 'korunmali');

    const result = await runReset(guild, { store });

    expect(result.errors).toEqual([]);
    expect(result.deletedChannels).toBe(channelCount);
    expect(result.deletedRoles).toBe(roleCount);
    expect(guild.channels.cache.size).toBe(0);
    expect(guild.roles.cache.size).toBe(0);
    expect((await store.getMap('channels_map', GUILD_ID)).length).toBe(0);
    expect((await store.getMap('roles_map', GUILD_ID)).length).toBe(0);
    expect(store.setupDone.get(GUILD_ID)).toBe(false);
    expect(store.settings.get(`${GUILD_ID}:kullanici.verisi`)).toBe('korunmali');
    expect(plan.channels.length).toBeGreaterThan(0);
  });

  it('kayitsiz kanal/rol/kategori dahil HER SEYI siler; korunan kanal kalir', async () => {
    const { guild, store } = await setupEverything();
    // Kurulum disi ekstra yapi: kategori + kanal + rol
    const extraCategory = await guild.channels.create({ name: 'kategori-x', type: 4 });
    const extraText = await guild.channels.create({ name: 'genel-x', type: 0, parent: extraCategory.id });
    await guild.roles.create({ name: 'ozel-rol' });
    const totalChannels = guild.channels.cache.size;
    const totalRoles = guild.roles.cache.size;

    const result = await runReset(guild, { store, keepChannelIds: [extraText.id] });

    expect(result.errors).toEqual([]);
    // Kayitsiz kategori silindi, korunan kanal kaldi
    expect(guild.channels.cache.has(extraCategory.id)).toBe(false);
    expect(guild.channels.cache.has(extraText.id)).toBe(true);
    expect(result.keptChannels).toBe(1);
    expect(result.deletedChannels).toBe(totalChannels - 1);
    // Kayitsiz rol de silindi
    expect(result.deletedRoles).toBe(totalRoles);
    expect(guild.roles.cache.size).toBe(0);
  });

  it('everyone, yonetilen ve hiyerarsi ustundeki roller atlanir', async () => {
    const { guild, store } = await setupEverything();
    guild.roles.cache.set(GUILD_ID, { id: GUILD_ID, name: '@everyone', position: 0, managed: false });
    guild.roles.cache.set('managed1', { id: 'managed1', name: 'bot-rol', position: 2, managed: true });
    guild.roles.cache.set('high1', { id: 'high1', name: 'patron', position: 150, managed: false });

    const result = await runReset(guild, { store });

    expect(guild.roles.cache.has(GUILD_ID)).toBe(true);
    expect(guild.roles.cache.has('managed1')).toBe(true);
    expect(guild.roles.cache.has('high1')).toBe(true);
    expect(result.skippedRoles.map((s) => s.reason).sort()).toEqual(['hiyerarsi_yetersiz', 'yonetilen_rol']);
    expect(result.errors).toEqual([]);
  });
});

describe('evaluatePrecheck', () => {
  it('administrator ile temiz gecer', () => {
    const result = evaluatePrecheck({ isAdmin: true, highestRolePosition: 50 });
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it('admin degilse eksik izinleri tek tek listeler', () => {
    const result = evaluatePrecheck({
      isAdmin: false,
      canManageChannels: false,
      canManageRoles: true,
      canManageWebhooks: false,
      highestRolePosition: 10,
    });
    expect(result.ok).toBe(false);
    expect(result.problems.map((p) => p.code)).toEqual(['izin_kanal_yonetimi']);
    expect(result.warnings.map((w) => w.code)).toContain('webhook_yok');
  });

  it('kara liste kurulumu engeller', () => {
    const result = evaluatePrecheck({ isAdmin: true, blacklisted: true, highestRolePosition: 10 });
    expect(result.ok).toBe(false);
    expect(result.problems.map((p) => p.code)).toContain('kara_liste');
  });

  it('bot rolu en alttaysa hiyerarsi uyarisi verir', () => {
    const result = evaluatePrecheck({ isAdmin: true, highestRolePosition: 1 });
    expect(result.warnings.map((w) => w.code)).toContain('hiyerarsi_dusuk');
  });

  it('onceki kurulum bilgisini tasir', () => {
    const result = evaluatePrecheck({ isAdmin: true, highestRolePosition: 5, existingRoles: 3, existingChannels: 7 });
    expect(result.hasExisting).toBe(true);
    expect(result.existingRoles).toBe(3);
    expect(result.existingChannels).toBe(7);
  });
});
