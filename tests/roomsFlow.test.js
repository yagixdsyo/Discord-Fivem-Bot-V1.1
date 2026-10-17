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

vi.mock('../src/modules/fivem/lib/gate.js', () => ({
  systemReady: vi.fn(async () => true),
}));

import { createTranslator } from '../src/locales/index.js';
import { clearFivemMemory, findOneDoc, insertDoc } from '../src/modules/fivem/lib/store.js';
import {
  getRoomsConfig,
  kickFromRoom,
  roomCreatePanelPayload,
  roomPanelPayload,
  setRoomsConfig,
} from '../src/modules/rooms/lib/rooms.js';
import { registerRoomsSetupPanels } from '../src/modules/rooms/lib/setupPanels.js';
import voiceStateUpdate from '../src/modules/rooms/events/voiceStateUpdate.js';
import { listSetupPanels } from '../src/modules/setup/lib/panels.js';

const t = createTranslator('tr');

function fakeMember(id, { bot = false, channelId = null } = {}) {
  return {
    id,
    user: { id, bot, username: `uye-${id}` },
    voice: {
      channelId,
      disconnect: vi.fn(async () => true),
      setChannel: vi.fn(async () => true),
    },
  };
}

function fakeVoiceChannel(id, members = []) {
  const cache = new Map(members.map((member) => [member.id, member]));
  return {
    id,
    type: 2,
    members: {
      values: () => cache.values(),
      has: (memberId) => cache.has(memberId),
      get: (memberId) => cache.get(memberId),
    },
    permissionOverwrites: { edit: vi.fn(async () => true) },
    delete: vi.fn(async () => true),
    setName: vi.fn(async () => true),
    setUserLimit: vi.fn(async () => true),
    send: vi.fn(async () => ({ id: 'panel-msg' })),
    messages: { fetch: vi.fn(async () => null) },
  };
}

function fakeGuild(channels = []) {
  const cache = new Map(channels.map((channel) => [channel.id, channel]));
  return {
    id: 'g1',
    name: 'Test Sunucu',
    channels: {
      cache,
      fetch: vi.fn(async (id) => cache.get(id) ?? null),
      create: vi.fn(async () => null),
    },
    members: { fetch: vi.fn(async () => null) },
    roles: { everyone: { id: 'everyone' } },
  };
}

async function insertRoom(patch = {}) {
  const doc = {
    room_id: 'r1',
    guild_id: 'g1',
    channel_id: 'c1',
    owner_id: 'owner1',
    name: 'Test Odasi',
    limit: 0,
    locked: false,
    panel_message_id: null,
    ...patch,
  };
  await insertDoc('rooms', doc);
  return doc;
}

beforeEach(() => {
  clearFivemMemory();
  settingsStore.clear();
});

describe('oda ayarlari', () => {
  it('sahip cikinca silme varsayilan olarak aciktir', async () => {
    const config = await getRoomsConfig('g1');
    expect(config.ownerLeaveDelete).toBe(true);
  });

  it('ayar kapatilabilir', async () => {
    await setRoomsConfig('g1', { ownerLeaveDelete: false });
    expect((await getRoomsConfig('g1')).ownerLeaveDelete).toBe(false);
  });
});

describe('kisi ekle / kisi cikar', () => {
  it('cikarilan kisi kanaldan atilir ve tekrar girmesi kapatilir', async () => {
    await insertRoom();
    const channel = fakeVoiceChannel('c1');
    const guild = fakeGuild([channel]);
    const member = fakeMember('m9', { channelId: 'c1' });

    const result = await kickFromRoom(guild, { room_id: 'r1', channel_id: 'c1' }, member, 'owner1');
    expect(result.ok).toBe(true);
    expect(member.voice.disconnect).toHaveBeenCalled();
    expect(channel.permissionOverwrites.edit).toHaveBeenCalledWith('m9', { Connect: false, ViewChannel: null });
  });

  it('kanal yoksa ok:false doner', async () => {
    const guild = fakeGuild([]);
    const result = await kickFromRoom(guild, { room_id: 'r1', channel_id: 'yok' }, fakeMember('m9'), 'owner1');
    expect(result.ok).toBe(false);
  });
});

describe('oda paneli gelistirmesi', () => {
  it('panel canli uye listesi, yasak sayisi ve ekle/cikar secimlerini gosterir', async () => {
    await insertRoom({ panel_message_id: null });
    await insertDoc('room_bans', { guild_id: 'g1', room_id: 'r1', user_id: 'banned1', by: 'owner1' });

    const channel = fakeVoiceChannel('c1', [fakeMember('m1'), fakeMember('m2')]);
    const guild = fakeGuild([channel]);

    const payload = await roomPanelPayload(t, { room_id: 'r1', channel_id: 'c1', owner_id: 'owner1', name: 'OdA', limit: 0, locked: false }, { guild });
    const json = JSON.stringify(payload);
    expect(json).toContain('<@m1>');
    expect(json).toContain('<@m2>');
    expect(json).toContain('oda:ekle:r1');
    expect(json).toContain('oda:cikar:r1');
    expect(json).toContain('oda:yasak:r1');
    expect(json).toContain('Yasaklı');
  });

  it('uye yoksa bos liste metni kullanilir', async () => {
    await insertRoom();
    const channel = fakeVoiceChannel('c1', []);
    const guild = fakeGuild([channel]);
    const payload = await roomPanelPayload(t, { room_id: 'r1', channel_id: 'c1', owner_id: 'owner1', name: 'OdA', limit: 0, locked: false }, { guild });
    expect(JSON.stringify(payload)).toContain('Odada henüz kimse yok');
  });

  it('olusturma paneli butonlu kart uretir', () => {
    const payload = roomCreatePanelPayload(t);
    expect(JSON.stringify(payload)).toContain('oda:olustur');
  });
});

describe('cikinca silme + panel tazeleme', () => {
  it('sahip ayrilinca oda (dolu olsa bile) silinir', async () => {
    await insertRoom({ owner_id: 'owner1' });
    const owner = fakeMember('owner1', { channelId: 'c1' });
    const other = fakeMember('m2', { channelId: 'c1' });
    const roomChannel = fakeVoiceChannel('c1', [other]);
    const idle = fakeVoiceChannel('c2', []);
    const guild = fakeGuild([roomChannel, idle]);

    await voiceStateUpdate.execute(
      { channelId: 'c1', guild, member: owner },
      { channelId: 'c2', guild, member: owner },
    );

    expect(roomChannel.delete).toHaveBeenCalled();
    expect(await findOneDoc('rooms', { guild_id: 'g1', room_id: 'r1' })).toBe(null);
  });

  it('ayar kapaliyken sahip ayrilirsa oda silinmez, panel tazelenir', async () => {
    await setRoomsConfig('g1', { ownerLeaveDelete: false });
    const panelMessage = { edit: vi.fn(async () => true) };
    await insertRoom({ owner_id: 'owner1', panel_message_id: 'pm1' });
    const owner = fakeMember('owner1', { channelId: 'c1' });
    const other = fakeMember('m2', { channelId: 'c1' });
    const roomChannel = fakeVoiceChannel('c1', [other]);
    roomChannel.messages.fetch = vi.fn(async () => panelMessage);
    const idle = fakeVoiceChannel('c2', []);
    const guild = fakeGuild([roomChannel, idle]);

    await voiceStateUpdate.execute(
      { channelId: 'c1', guild, member: owner },
      { channelId: 'c2', guild, member: owner },
    );

    expect(roomChannel.delete).not.toHaveBeenCalled();
    expect(panelMessage.edit).toHaveBeenCalled();
    expect(await findOneDoc('rooms', { guild_id: 'g1', room_id: 'r1' })).toBeTruthy();
  });

  it('son kisi cikinca oda silinir', async () => {
    await insertRoom({ owner_id: 'owner1' });
    const leaver = fakeMember('m2', { channelId: 'c1' });
    const roomChannel = fakeVoiceChannel('c1', []);
    const idle = fakeVoiceChannel('c2', []);
    const guild = fakeGuild([roomChannel, idle]);

    await voiceStateUpdate.execute(
      { channelId: 'c1', guild, member: leaver },
      { channelId: 'c2', guild, member: leaver },
    );

    expect(roomChannel.delete).toHaveBeenCalled();
    expect(await findOneDoc('rooms', { guild_id: 'g1', room_id: 'r1' })).toBe(null);
  });

  it('odaya giren olunca panel tazelenir (uye listesi)', async () => {
    const joiner = fakeMember('m3');
    const panelMessage = { edit: vi.fn(async () => true) };
    await insertRoom({ panel_message_id: 'pm1' });
    const roomChannel = fakeVoiceChannel('c1', [joiner]);
    roomChannel.messages.fetch = vi.fn(async () => panelMessage);
    const hub = fakeVoiceChannel('hub', []);
    const guild = fakeGuild([roomChannel, hub]);

    await voiceStateUpdate.execute(
      { channelId: 'hub', guild, member: joiner },
      { channelId: 'c1', guild, member: joiner },
    );

    expect(panelMessage.edit).toHaveBeenCalled();
    expect(JSON.stringify(panelMessage.edit.mock.calls[0][0])).toContain('<@m3>');
  });
});

describe('kurulum paneli', () => {
  it('panel_oda kaydi afterPost ile panel + hub ayarlarini yazar', async () => {
    registerRoomsSetupPanels();
    const def = listSetupPanels().find((panel) => panel.key === 'panel_oda');
    expect(def).toBeTruthy();
    expect(def.channelKey).toBe('panel_oda');

    const built = await def.build({ guild: { id: 'g1', name: 'Test' } });
    expect(JSON.stringify(built)).toContain('oda:olustur');

    await def.afterPost({
      guild: { id: 'g1' },
      channel: { id: 'panel-ch' },
      message: { id: 'panel-msg' },
      store: {
        getMap: vi.fn(async (name) => (name === 'channels_map' ? [{ key: 'oda_hub', channel_id: 'hub-ch' }] : [])),
      },
    });

    const config = await getRoomsConfig('g1');
    expect(config.panelChannelId).toBe('panel-ch');
    expect(config.panelMessageId).toBe('panel-msg');
    expect(config.hubChannelId).toBe('hub-ch');
  });
});

describe('/oda-kur', () => {
  it('sahipsil kapat ve kategori ayarlarini kaydeder', async () => {
    const mod = await import('../src/modules/rooms/commands/odakur.js');
    const panelChannel = {
      id: 'tc1',
      isTextBased: () => true,
      send: vi.fn(async () => ({ id: 'pm1' })),
      messages: { fetch: vi.fn(async () => null) },
    };
    const guild = {
      id: 'g1',
      name: 'Test Sunucu',
      channels: { cache: new Map([['tc1', panelChannel]]), fetch: vi.fn(async () => null) },
    };
    const replies = [];
    const ctx = {
      t,
      db: { ready: true },
      args: { kanal: panelChannel, seskanal: null, kategori: { id: 'cat1', name: 'ODALAR' }, sahipsil: 'kapat' },
      user: { id: 'yonetici', username: 'yonetici' },
      guild,
      reply: async (payload) => replies.push(payload),
      followUp: async (payload) => replies.push(payload),
    };

    await mod.default.run(ctx);

    const config = await getRoomsConfig('g1');
    expect(config.panelChannelId).toBe('tc1');
    expect(config.panelMessageId).toBe('pm1');
    expect(config.categoryId).toBe('cat1');
    expect(config.ownerLeaveDelete).toBe(false);
    expect(JSON.stringify(replies[0])).toContain('Sahip çıkınca oda silme');
  });
});
