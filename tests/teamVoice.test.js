/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { clearFivemMemory, insertDoc, updateDoc } from '../src/modules/fivem/lib/store.js';
import { formatSeconds, onVoiceUpdate, sessionSeconds, voiceSummary } from '../src/modules/team/lib/voice.js';
import { createTeam, resolveTeam } from '../src/modules/team/lib/teams.js';

const G = 'g1';
const ago = (seconds) => new Date(Date.now() - seconds * 1000).toISOString();

function mockGuild() {
  let n = 0;
  return {
    id: G,
    roles: { create: async () => ({ id: `role-${++n}` }) },
    channels: { create: async ({ name }) => ({ id: `ch-${n}-${name}` }) },
  };
}

beforeEach(() => clearFivemMemory());

describe('ekip ses oturumlari', () => {
  it('giris oturum acar, cikis sure ile kapar', async () => {
    await onVoiceUpdate({ guildId: G, userId: 'u1', oldChannelId: null, newChannelId: 'c1' });
    // Oturum acik; joined_at geriye cekilerek sure dogrulanir (acik oturum cap 12 sa).
    await updateDoc('team_voice_sessions', { guild_id: G, user_id: 'u1', left_at: null }, { joined_at: ago(600) });
    const open = await voiceSummary({ guildId: G, userIds: ['u1'], days: 7 });
    expect(open.get('u1')).toBeGreaterThanOrEqual(599);

    await onVoiceUpdate({ guildId: G, userId: 'u1', oldChannelId: 'c1', newChannelId: null });
    const closed = await voiceSummary({ guildId: G, userIds: ['u1'], days: 7 });
    expect(closed.get('u1')).toBeGreaterThanOrEqual(599);
  });

  it('kanal filtresi ve donem penceresi uygular', async () => {
    await insertDoc('team_voice_sessions', { session_id: 's1', guild_id: G, user_id: 'u2', channel_id: 'c1', joined_at: ago(600), left_at: ago(300), duration_seconds: 300 });
    await insertDoc('team_voice_sessions', { session_id: 's2', guild_id: G, user_id: 'u2', channel_id: 'c2', joined_at: ago(1200), left_at: ago(900), duration_seconds: 300 });
    await insertDoc('team_voice_sessions', { session_id: 's3', guild_id: G, user_id: 'u2', channel_id: 'c1', joined_at: ago(20 * 86400), left_at: ago(20 * 86400 - 120), duration_seconds: 120 });

    const all = await voiceSummary({ guildId: G, userIds: ['u2'], days: 7 });
    expect(all.get('u2')).toBe(600);

    const onlyC1 = await voiceSummary({ guildId: G, userIds: ['u2'], days: 7, channelIds: ['c1'] });
    expect(onlyC1.get('u2')).toBe(300);

    const wide = await voiceSummary({ guildId: G, userIds: ['u2'], days: 30 });
    expect(wide.get('u2')).toBe(720);
  });

  it('sessionSeconds acik oturumu 12 saatle sinirlar', () => {
    const openDoc = { joined_at: ago(13 * 3600), left_at: null, duration_seconds: 0 };
    expect(sessionSeconds(openDoc)).toBe(12 * 3600);
    const closedDoc = { joined_at: ago(5000), left_at: ago(1000), duration_seconds: 4000 };
    expect(sessionSeconds(closedDoc)).toBe(4000);
  });

  it('formatSeconds okunabilir sure uretir', () => {
    expect(formatSeconds(45)).toBe('45 sn');
    expect(formatSeconds(125)).toBe('2 dk');
    expect(formatSeconds(3725)).toBe('1 sa 2 dk');
    expect(formatSeconds(null)).toBe('0 sn');
  });
});

describe('ekip cozumleme', () => {
  it('id ve ada gore (Turkce uyumlu) ekibi bulur', async () => {
    const team = await createTeam({ guild: mockGuild(), name: 'Kartallar', kind: 'legal', bossMember: null, limit: 10, color: null });
    expect(team.team_id).toBeTruthy();

    const byId = await resolveTeam(G, team.team_id);
    expect(byId?.name).toBe('Kartallar');

    const byName = await resolveTeam(G, '  kartallar ');
    expect(byName?.team_id).toBe(team.team_id);

    const partial = await resolveTeam(G, 'KARTAL');
    expect(partial?.team_id).toBe(team.team_id);

    expect(await resolveTeam(G, 'bilinmeyen')).toBe(null);
    expect(await resolveTeam(G, '')).toBe(null);
  });
});
