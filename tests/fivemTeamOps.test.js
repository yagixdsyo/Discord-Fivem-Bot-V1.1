/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../src/locales/index.js';
import { getColor } from '../src/ui/colors.js';

vi.mock('../src/modules/fivem/lib/teams.js', () => ({
  getTeam: vi.fn(),
  updateTeam: vi.fn(async () => ({ ok: true })),
  listTeams: vi.fn(async () => []),
  toggleWritingLock: vi.fn(async () => ({ ok: true })),
  closeTeam: vi.fn(async () => ({ ok: true, failed: [] })),
}));

const t = createTranslator('tr');

function makeCtx(args = {}) {
  const replies = [];
  const ctx = {
    t,
    db: { ready: true },
    args,
    user: { id: 'a1', username: 'yonetici' },
    guild: { id: 'g1', name: 'Test' },
    reply: async (payload) => replies.push(payload),
    followUp: async (payload) => replies.push(payload),
  };
  return { ctx, replies };
}

function accentOf(payload) {
  const raw = payload.components[0].toJSON();
  return raw.accent_color ?? raw.accentColor;
}

const FAKE_TEAM = {
  team_id: 'e-1',
  name: 'Test Ekibi',
  active: true,
  type: 'legal',
  patron_id: 'p1',
  boss_ids: ['b1'],
  role_id: 'r1',
  writing_locked: false,
};

async function teamsMock() {
  return import('../src/modules/fivem/lib/teams.js');
}

beforeEach(async () => {
  vi.clearAllMocks();
  const teams = await teamsMock();
  teams.getTeam.mockImplementation(async () => ({ ...FAKE_TEAM, boss_ids: [...FAKE_TEAM.boss_ids] }));
});

describe('ekip-boss-ekle', () => {
  it('boss kartinda success accent ve ekip kodu olur', async () => {
    const command = (await import('../src/modules/fivem/commands/ekipbossekle.js')).default;
    const { ctx, replies } = makeCtx({ ekip: 'Test', kullanici: { id: 'u9' } });
    await command.run(ctx);
    expect(replies).toHaveLength(1);
    expect(accentOf(replies[0])).toBe(getColor('success'));
    expect(JSON.stringify(replies[0])).toContain('e-1');

    const teams = await teamsMock();
    const call = teams.updateTeam.mock.calls[0];
    expect(call[2].boss_ids).toEqual(['b1', 'u9']);
  });

  it('patron boss olarak eklenemez', async () => {
    const command = (await import('../src/modules/fivem/commands/ekipbossekle.js')).default;
    const { ctx, replies } = makeCtx({ ekip: 'Test', kullanici: { id: 'p1' } });
    await command.run(ctx);
    expect(replies).toHaveLength(1);
    expect(JSON.stringify(replies[0])).toContain('patronu');
  });
});

describe('ekip-boss-cikar', () => {
  it('cikarma kartinda warn accent kullanilir', async () => {
    const command = (await import('../src/modules/fivem/commands/ekipbosscikar.js')).default;
    const { ctx, replies } = makeCtx({ ekip: 'Test', kullanici: { id: 'b1' } });
    await command.run(ctx);
    expect(accentOf(replies[0])).toBe(getColor('warn'));
    const teams = await teamsMock();
    expect(teams.updateTeam.mock.calls[0][2]).toEqual({ boss_ids: [] });
  });

  it('boss olmayan kullanici icin hata karti', async () => {
    const command = (await import('../src/modules/fivem/commands/ekipbosscikar.js')).default;
    const { ctx, replies } = makeCtx({ ekip: 'Test', kullanici: { id: 'yok' } });
    await command.run(ctx);
    expect(JSON.stringify(replies[0])).toContain('bossu değil');
  });
});

describe('ekip-patron', () => {
  it('patron atama success kart doner', async () => {
    const command = (await import('../src/modules/fivem/commands/ekippatronekle.js')).default;
    const { ctx, replies } = makeCtx({ ekip: 'Test', kullanici: { id: 'u9' } });
    await command.run(ctx);
    expect(accentOf(replies[0])).toBe(getColor('success'));
    const teams = await teamsMock();
    expect(teams.updateTeam.mock.calls[0][2]).toEqual({ patron_id: 'u9', boss_ids: ['b1'] });
  });

  it('patron kaldirma warn kart doner', async () => {
    const command = (await import('../src/modules/fivem/commands/ekippatroncikar.js')).default;
    const { ctx, replies } = makeCtx({ ekip: 'Test' });
    await command.run(ctx);
    expect(accentOf(replies[0])).toBe(getColor('warn'));
    expect(JSON.stringify(replies[0])).toContain('p1');
  });
});

describe('ekip-yazma-kilidi', () => {
  it('kilitle warn, ac success accent kullanir', async () => {
    const command = (await import('../src/modules/fivem/commands/ekipyazmakilidi.js')).default;
    const locked = makeCtx({ ekip: 'Test', durum: 'kilit' });
    await command.run(locked.ctx);
    expect(accentOf(locked.replies[0])).toBe(getColor('warn'));
    expect(JSON.stringify(locked.replies[0])).toContain('Yazma Kilidi');

    const teams = await teamsMock();
    teams.toggleWritingLock.mockClear();
    const unlocked = makeCtx({ ekip: 'Test', durum: 'acik' });
    await command.run(unlocked.ctx);
    expect(accentOf(unlocked.replies[0])).toBe(getColor('success'));
  });
});

describe('ekip-basvuru', () => {
  it('kapatilan tur icin warn accent ve sayi tasir', async () => {
    const teams = await teamsMock();
    teams.listTeams.mockResolvedValueOnce([{ team_id: 'e-1' }, { team_id: 'e-2' }]);
    const command = (await import('../src/modules/fivem/commands/ekipbasvuru.js')).default;
    const { ctx, replies } = makeCtx({ durum: 'kapat', tür: 'illegal' });
    await command.run(ctx);
    expect(accentOf(replies[0])).toBe(getColor('warn'));
    const raw = JSON.stringify(replies[0]);
    expect(raw).toContain('Illegal');
    expect(raw).toContain('2');
  });
});

describe('locale duzeltmeleri', () => {
  it('yeni anahtarlar ve placeholderlar cozulur', () => {
    expect(t('fivem.ekip.boss_added', { ad: 'X', kullanici: 'Y' })).toContain('boss olarak eklendi');
    expect(t('fivem.ekip.not_boss', { kullanici: 'Y' })).toContain('bossu değil');
    expect(t('fivem.ekip.already_patron')).toContain('patronu');
    expect(t('fivem.ekip.lock_title')).toBe('Yazma Kilidi');
    const opened = t('fivem.ekip.basvuru_opened', { tur: 'Legal', adet: '3' });
    expect(opened).toContain('Legal');
    expect(opened).toContain('3');
    expect(t('fivem.donate.amount_line', { tutar: '250 TL' })).toContain('250 TL');
    expect(t('fivem.donate.note_line', { not: 'test' })).toContain('test');
  });
});
