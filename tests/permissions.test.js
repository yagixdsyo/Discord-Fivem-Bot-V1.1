/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import { decidePermission } from '../src/core/permissions.js';

// ---------------------------------------------------------------------------
// Sahte member yardimcisi
// ---------------------------------------------------------------------------

function makeMember({ id = '1', permBits = [], admin = false, roleIds = [] } = {}) {
  return {
    id,
    permissions: {
      has: (bit) =>
        admin
          ? bit === PermissionFlagsBits.Administrator || permBits.includes(bit)
          : permBits.includes(bit),
    },
    roles: { cache: new Map(roleIds.map((roleId) => [roleId, { id: roleId }])) },
  };
}

const plainGuild = { ownerId: '999999999999999999' };

// ---------------------------------------------------------------------------

describe('decidePermission', () => {
  it('kosulsuz komut herkese aciktir', () => {
    const result = decidePermission({ command: {}, member: makeMember(), guild: plainGuild });
    expect(result.ok).toBe(true);
  });

  it('ownerOnly komut yalnizca sahibe aciktir', () => {
    expect(
      decidePermission({ command: { ownerOnly: true }, member: makeMember(), guild: plainGuild, isOwner: true }).ok,
    ).toBe(true);

    const denied = decidePermission({
      command: { ownerOnly: true },
      member: makeMember({ admin: true }),
      guild: plainGuild,
      isOwner: false,
    });
    expect(denied.ok).toBe(false);
    expect(denied.reason).toBe('owner_only');
  });

  it('bot sahibi tum kontrolleri gecer', () => {
    const result = decidePermission({
      command: { permission: { discord: ['BanMembers'] } },
      member: makeMember(),
      guild: plainGuild,
      isOwner: true,
    });
    expect(result.ok).toBe(true);
  });

  it('sunucu sahibi gecer', () => {
    const result = decidePermission({
      command: { permission: { discord: ['BanMembers'] } },
      member: makeMember({ id: '42' }),
      guild: { ownerId: '42' },
    });
    expect(result.ok).toBe(true);
  });

  it('Administrator izni olan uye gecer', () => {
    const result = decidePermission({
      command: { permission: { discord: ['BanMembers'] } },
      member: makeMember({ admin: true }),
      guild: plainGuild,
    });
    expect(result.ok).toBe(true);
  });

  it('discord izni kosulu OR olarak saglanir', () => {
    const result = decidePermission({
      command: { permission: { discord: ['BanMembers'] } },
      member: makeMember({ permBits: [PermissionFlagsBits.BanMembers] }),
      guild: plainGuild,
    });
    expect(result.ok).toBe(true);
  });

  it('discord izni eksikse missing listesi doner', () => {
    const result = decidePermission({
      command: { permission: { discord: ['BanMembers'] } },
      member: makeMember(),
      guild: plainGuild,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('discord_permission');
    expect(result.missing).toEqual(['BanMembers']);
  });

  it('bilinmeyen izin adi eksik sayilir', () => {
    const result = decidePermission({
      command: { permission: { discord: ['BoyleBirIzinYok'] } },
      member: makeMember(),
      guild: plainGuild,
    });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('BoyleBirIzinYok');
  });

  it('yetki dugumu user_ids ile saglanir', () => {
    const result = decidePermission({
      command: { permission: { node: 'yetkili' } },
      member: makeMember({ id: '7' }),
      guild: plainGuild,
      permNode: { user_ids: ['7'], role_ids: [] },
    });
    expect(result.ok).toBe(true);
  });

  it('yetki dugumu role_ids ile saglanir', () => {
    const result = decidePermission({
      command: { permission: { node: 'yetkili' } },
      member: makeMember({ id: '7', roleIds: ['55'] }),
      guild: plainGuild,
      permNode: { user_ids: [], role_ids: ['55'] },
    });
    expect(result.ok).toBe(true);
  });

  it('yetki dugumu eslesmezse reason=node doner', () => {
    const result = decidePermission({
      command: { permission: { node: 'yetkili' } },
      member: makeMember({ id: '7' }),
      guild: plainGuild,
      permNode: { user_ids: ['8'], role_ids: [] },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('node');
    expect(result.node).toBe('yetkili');
  });

  it('OR semantigi: discord izni varken node bos olsa da gecilir', () => {
    const result = decidePermission({
      command: { permission: { discord: ['BanMembers'], node: 'yetkili' } },
      member: makeMember({ permBits: [PermissionFlagsBits.BanMembers] }),
      guild: plainGuild,
      permNode: null,
    });
    expect(result.ok).toBe(true);
  });

  it('DM (member yok) kosulsuz komutta gecer, kosulluda reddedilir', () => {
    expect(decidePermission({ command: {}, member: null, guild: null }).ok).toBe(true);
    const denied = decidePermission({
      command: { permission: { discord: ['BanMembers'] } },
      member: null,
      guild: null,
    });
    expect(denied.ok).toBe(false);
  });
});
