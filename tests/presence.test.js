/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearPresence,
  findOnlineByDiscordId,
  hasPresenceData,
  listOnlinePlayers,
  onlineCount,
  recordPlayerJoin,
  recordPlayerLeave,
} from '../src/modules/fivem/lib/presence.js';

const G = 'g1';

beforeEach(() => clearPresence());

describe('fivem presence takibi', () => {
  it('giris kaydi ve discord kimligiyle eslesme', () => {
    expect(hasPresenceData(G)).toBe(false);
    expect(recordPlayerJoin(G, { id: 12, name: 'Ahmet', identifiers: ['license:abc', 'discord:555'] })).toBe(true);
    expect(hasPresenceData(G)).toBe(true);
    expect(onlineCount(G)).toBe(1);
    const found = findOnlineByDiscordId(G, '555');
    expect(found?.name).toBe('Ahmet');
    expect(found?.id).toBe('12');
  });

  it('cikis kaydi oyuncuyu siler, takip bayragi kalir', () => {
    recordPlayerJoin(G, { id: 12, name: 'Ahmet', identifiers: ['discord:555'] });
    expect(recordPlayerLeave(G, { id: 12 })).toBe(true);
    expect(onlineCount(G)).toBe(0);
    expect(findOnlineByDiscordId(G, '555')).toBe(null);
    expect(hasPresenceData(G)).toBe(true);
  });

  it('id degisse bile kimlikle eslesip siler', () => {
    recordPlayerJoin(G, { id: 7, identifiers: ['discord:42'] });
    expect(recordPlayerLeave(G, { id: 99, identifiers: ['discord:42'] })).toBe(true);
    expect(onlineCount(G)).toBe(0);
  });

  it('gecersiz kayitlar yok sayilir', () => {
    expect(recordPlayerJoin(G, {})).toBe(false);
    expect(recordPlayerJoin('', { id: 1 })).toBe(false);
    expect(recordPlayerLeave(G, { id: 1 })).toBe(false);
  });

  it('liste ve temizleme', () => {
    recordPlayerJoin(G, { id: 1, name: 'A', identifiers: ['discord:1'] });
    recordPlayerJoin(G, { id: 2, name: 'B', identifiers: ['discord:2'] });
    expect(listOnlinePlayers(G)).toHaveLength(2);
    clearPresence(G);
    expect(onlineCount(G)).toBe(0);
    expect(hasPresenceData(G)).toBe(false);
  });
});
