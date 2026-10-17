/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import {
  channelSnapshot,
  emojiSnapshot,
  roleSnapshot,
  stickerSnapshot,
} from '../src/modules/guard/lib/restore.js';

function fakeRole() {
  return {
    id: 'r1',
    name: 'Test Rol',
    color: 123,
    hoist: true,
    mentionable: false,
    position: 7,
    permissions: { bitfield: 8n },
    managed: false,
    members: new Map([
      ['u1', {}],
      ['u2', {}],
    ]),
  };
}

function fakeChannel() {
  return {
    id: 'c1',
    name: 'genel',
    type: 0,
    parentId: 'cat1',
    position: 4,
    topic: 'konu',
    nsfw: false,
    rateLimitPerUser: 2,
    userLimit: 0,
    bitrate: null,
    permissionOverwrites: {
      cache: new Map([
        ['r1', { id: 'r1', type: 0, allow: { bitfield: 8n }, deny: { bitfield: 0n } }],
        ['u5', { id: 'u5', type: 1, allow: { bitfield: 0n }, deny: { bitfield: 1024n } }],
      ]),
    },
  };
}

describe('rol snapshot', () => {
  it('izin/renk/sira ve uyeleri alir', () => {
    const snapshot = roleSnapshot(fakeRole());
    expect(snapshot.name).toBe('Test Rol');
    expect(snapshot.color).toBe(123);
    expect(snapshot.hoist).toBe(true);
    expect(snapshot.position).toBe(7);
    expect(snapshot.permissions).toBe('8');
    expect(snapshot.memberIds.sort()).toEqual(['u1', 'u2']);
  });

  it('withMembers false iken uye listesi bos', () => {
    const snapshot = roleSnapshot(fakeRole(), { withMembers: false });
    expect(snapshot.memberIds).toEqual([]);
  });
});

describe('kanal snapshot', () => {
  it('izin agi string bitfield olarak kopyalanir', () => {
    const snapshot = channelSnapshot(fakeChannel());
    expect(snapshot.type).toBe(0);
    expect(snapshot.parentId).toBe('cat1');
    expect(snapshot.topic).toBe('konu');
    expect(snapshot.overwrites.length).toBe(2);
    const roleOverwrite = snapshot.overwrites.find((entry) => entry.id === 'r1');
    expect(roleOverwrite.allow).toBe('8');
    expect(roleOverwrite.deny).toBe('0');
  });

  it('izin agi olmayan kanalda bos liste', () => {
    const snapshot = channelSnapshot({ id: 'x', name: 'x', type: 2 });
    expect(snapshot.overwrites).toEqual([]);
    expect(snapshot.parentId).toBeNull();
  });
});

describe('emoji/sticker snapshot', () => {
  it('emoji url ve animasyon bilgisi alinir', () => {
    const snapshot = emojiSnapshot({ id: 'e1', name: 'emote', animated: true, imageURL: () => 'https://cdn.test/e1.png' });
    expect(snapshot.animated).toBe(true);
    expect(snapshot.url).toBe('https://cdn.test/e1.png');
  });

  it('sticker etiket ve url alinir', () => {
    const snapshot = stickerSnapshot({ id: 's1', name: 'sticker', tags: 'etiket', url: 'https://cdn.test/s1.png' });
    expect(snapshot.tags).toBe('etiket');
    expect(snapshot.url).toBe('https://cdn.test/s1.png');
  });
});
