/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearFivemMemory } from '../src/modules/fivem/lib/store.js';
import { createTeam, getTeam, refreshTeamPanel } from '../src/modules/team/lib/teams.js';
import { canManageTeam, handleTeamPanelAction } from '../src/modules/team/lib/handlers.js';
import { createTranslator } from '../src/locales/index.js';

const t = createTranslator('tr');

function makeGuild() {
  const created = { role: null, rolePosition: null, channelOpts: [], panelPayload: null, pinned: false, edited: null };
  const anchor = { id: 'anchor1', name: 'Ekip Ust', position: 3 };
  const panelChannel = {
    id: 'ch2',
    type: 0,
    messages: { fetch: async (id) => ({ id, edit: async (payload) => { created.edited = payload; } }) },
    send: async (payload) => {
      created.panelPayload = payload;
      return { id: 'msg1', pin: async () => { created.pinned = true; } };
    },
  };
  const guild = {
    id: 'g1',
    roles: {
      everyone: { id: 'everyone1' },
      cache: new Map([['anchor1', anchor]]),
      fetch: async (id) => (id === 'anchor1' ? anchor : null),
      create: async (opts) => {
        const role = {
          id: 'role1',
          name: opts.name,
          color: opts.color,
          position: 0,
          setPosition: async (pos) => {
            role.position = pos;
            created.rolePosition = pos;
          },
        };
        created.role = role;
        return role;
      },
    },
    channels: {
      cache: new Map([['ch2', panelChannel]]),
      fetch: async (id) => (id === 'ch2' ? panelChannel : null),
      create: async (opts) => {
        created.channelOpts.push(opts);
        if (opts.type === 4) return { id: 'ch1', type: 4, name: opts.name };
        if (opts.type === 0) return panelChannel;
        return { id: 'ch3', type: 2, name: opts.name };
      },
    },
    members: { fetch: async () => null },
  };
  return { guild, created, anchor };
}

async function makeTeam(guild) {
  return createTeam({
    guild,
    name: 'Test Ekip',
    kind: 'legal',
    bossMember: { id: 'boss1', roles: { add: vi.fn(async () => {}) } },
    limit: 10,
    color: '#ff0000',
    anchorRoleId: 'anchor1',
    t,
  });
}

beforeEach(() => {
  clearFivemMemory();
});

describe('ekip kurulumu', () => {
  it('rol rengi, ust rol konumu, kategori izinleri ve sabit panel', async () => {
    const { guild, created } = makeGuild();
    const team = await makeTeam(guild);

    expect(created.role.color).toBe(0xff0000);
    expect(created.rolePosition).toBe(4); // anchor.position + 1

    expect(created.channelOpts.map((o) => o.type)).toEqual([4, 0, 2]);
    const category = created.channelOpts[0];
    expect(category.permissionOverwrites[0].id).toBe('everyone1');
    expect(category.permissionOverwrites[1].id).toBe('role1');

    expect(team.panel_message_id).toBe('msg1');
    expect(team.panel_channel_id).toBe('ch2');
    expect(created.pinned).toBe(true);

    const stored = await getTeam('g1', team.team_id);
    expect(stored.panel_message_id).toBe('msg1');
    expect(stored.panel_channel_id).toBe('ch2');
  });

  it('panel payload tum aksiyon customId degerlerini ve takim rengini icerir', async () => {
    const { guild, created } = makeGuild();
    const team = await makeTeam(guild);
    const raw = JSON.stringify(created.panelPayload);

    for (const action of ['ekle', 'cikar', 'patron', 'basvuru', 'senkron', 'bilgi', 'yenile']) {
      expect(raw).toContain(`ekip:p:${action}:${team.team_id}`);
    }
    expect(raw).toContain('"accent_color":16711680'); // #ff0000
  });

  it('panel yenileme mevcut mesaji duzenler', async () => {
    const { guild, created } = makeGuild();
    const team = await makeTeam(guild);
    const result = await refreshTeamPanel({ guild, team, t });
    expect(result.updated).toBe(true);
    expect(created.edited).toBeTruthy();
  });
});

describe('panel yetkisi', () => {
  it('patron ve ManageGuild yetkili; digerleri degil', () => {
    const team = { boss_id: 'boss1' };
    expect(canManageTeam(team, { id: 'boss1' }, null)).toBe(true);
    expect(canManageTeam(team, { id: 'other' }, { has: (p) => p === 'ManageGuild' })).toBe(true);
    expect(canManageTeam(team, { id: 'other' }, { has: () => false })).toBe(false);
    expect(canManageTeam(null, { id: 'boss1' }, null)).toBe(false);
  });

  it('yetkisiz kullaniciya gecici (ephemeral) hata karti', async () => {
    const { guild } = makeGuild();
    const team = await makeTeam(guild);
    const replies = [];
    const interaction = {
      guild,
      member: { id: 'random' },
      memberPermissions: { has: () => false },
      values: ['user9'],
      reply: async (payload) => { replies.push(payload); },
      followUp: async () => {},
    };
    await handleTeamPanelAction(interaction, 'ekle', team.team_id);
    expect(replies).toHaveLength(1);
    expect(replies[0].flags & 64).toBe(64); // Ephemeral
  });
});

describe('panel uye islemleri', () => {
  it('uye ekleme: rol verilir, kayda yazilir, panel yenilenir', async () => {
    const { guild, created } = makeGuild();
    const team = await makeTeam(guild);
    const added = vi.fn(async () => {});
    guild.members = { fetch: async (id) => ({ id, roles: { add: added, remove: vi.fn(async () => {}) } }) };
    guild.roles.cache.set('role1', { id: 'role1', position: 5 });

    const replies = [];
    const interaction = {
      guild,
      member: { id: 'boss1' },
      memberPermissions: { has: () => false },
      values: ['user9'],
      reply: async (payload) => { replies.push(payload); },
      followUp: async () => {},
    };
    await handleTeamPanelAction(interaction, 'ekle', team.team_id);

    expect(added).toHaveBeenCalled();
    const stored = await getTeam('g1', team.team_id);
    expect(stored.member_ids).toContain('user9');
    expect(replies).toHaveLength(1);
    expect(created.edited).toBeTruthy(); // panel yenilendi
  });

  it('patron cikarilamaz', async () => {
    const { guild } = makeGuild();
    const team = await makeTeam(guild);
    const replies = [];
    const interaction = {
      guild,
      member: { id: 'boss1' },
      memberPermissions: { has: () => false },
      values: ['boss1'],
      reply: async (payload) => { replies.push(payload); },
      followUp: async () => {},
    };
    await handleTeamPanelAction(interaction, 'cikar', team.team_id);
    expect(replies).toHaveLength(1);
    const stored = await getTeam('g1', team.team_id);
    expect(stored.member_ids).toContain('boss1');
  });

  it('basvuru durumu degistirilebilir', async () => {
    const { guild } = makeGuild();
    const team = await makeTeam(guild);
    const replies = [];
    const interaction = {
      guild,
      member: { id: 'boss1' },
      memberPermissions: { has: () => false },
      reply: async (payload) => { replies.push(payload); },
      followUp: async () => {},
    };
    await handleTeamPanelAction(interaction, 'basvuru', team.team_id);
    const stored = await getTeam('g1', team.team_id);
    expect(stored.application_open).toBe(false);
    expect(replies).toHaveLength(1);
  });
});

describe('ekip locale anahtarlari', () => {
  it('yeni anahtarlar cozulur', () => {
    const keys = [
      'team.panel_title',
      'team.panel_subtitle',
      'team.panel_select_add',
      'team.panel_select_remove',
      'team.panel_select_boss',
      'team.btn_application_open',
      'team.btn_sync',
      'team.btn_info',
      'team.btn_refresh',
      'team.member_added',
      'team.member_removed',
      'team.boss_changed',
      'team.limit_full',
      'team.settings_anchor_label',
      'team.settings_anchor_set',
      'team.panel_refreshed',
      'team.panel_reposted',
    ];
    for (const key of keys) {
      expect(String(t(key))).not.toBe(key);
    }
  });
});
