/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import { decidePermission } from '../src/core/permissions.js';
import { MAX_LEVEL, memberRankLevel } from '../src/core/rankLevels.js';

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

describe('memberRankLevel', () => {
  it('roller arasindan en yuksek seviyeyi doner', () => {
    expect(memberRankLevel(makeMember({ roleIds: ['r1', 'r2'] }), { r1: 2, r2: 5 })).toBe(5);
  });

  it('esleme yoksa 0 doner', () => {
    expect(memberRankLevel(makeMember({ roleIds: ['r9'] }), { r1: 2 })).toBe(0);
    expect(memberRankLevel(null, { r1: 2 })).toBe(0);
    expect(memberRankLevel(makeMember(), null)).toBe(0);
  });
});

describe('decidePermission - rankLevel', () => {
  it('yeterli seviye gecirir', () => {
    const result = decidePermission({
      command: { permission: { rankLevel: 3 } },
      member: makeMember({ roleIds: ['staff'] }),
      guild: plainGuild,
      rankLevels: { staff: 5 },
    });
    expect(result.ok).toBe(true);
  });

  it('yetersiz seviye rank nedeniyle reddedilir', () => {
    const result = decidePermission({
      command: { permission: { rankLevel: 3 } },
      member: makeMember({ roleIds: ['staff'] }),
      guild: plainGuild,
      rankLevels: { staff: 1 },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('rank');
    expect(result.rank).toEqual({ required: 3, member: 1 });
  });

  it('seviye tanimli degilse (bos esleme) gecmez', () => {
    const result = decidePermission({
      command: { permission: { rankLevel: 1 } },
      member: makeMember({ roleIds: ['staff'] }),
      guild: plainGuild,
      rankLevels: {},
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('rank');
  });

  it('OR semantigi: Discord izni veya node veya rutbe yeterli', () => {
    const discordOk = decidePermission({
      command: { permission: { discord: ['BanMembers'], node: 'moderation.ban', rankLevel: 3 } },
      member: makeMember({ permBits: [PermissionFlagsBits.BanMembers] }),
      guild: plainGuild,
      rankLevels: {},
    });
    expect(discordOk.ok).toBe(true);

    const nodeOk = decidePermission({
      command: { permission: { discord: ['ManageGuild'], node: 'moderation.ban', rankLevel: 3 } },
      member: makeMember({ id: 'u1' }),
      guild: plainGuild,
      permNode: { user_ids: ['u1'], role_ids: [] },
      rankLevels: {},
    });
    expect(nodeOk.ok).toBe(true);
  });

  it('rankLevel olmayan komut davranisi degismez', () => {
    const result = decidePermission({
      command: { permission: { discord: ['BanMembers'] } },
      member: makeMember(),
      guild: plainGuild,
      rankLevels: { staff: 9 },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('discord_permission');
  });

  it('admin ve sunucu sahibi rutbe kontrolunu gecer', () => {
    expect(
      decidePermission({
        command: { permission: { rankLevel: MAX_LEVEL } },
        member: makeMember({ admin: true }),
        guild: plainGuild,
      }).ok,
    ).toBe(true);
    expect(
      decidePermission({
        command: { permission: { rankLevel: MAX_LEVEL } },
        member: makeMember({ id: '42' }),
        guild: { ownerId: '42' },
      }).ok,
    ).toBe(true);
  });
});
