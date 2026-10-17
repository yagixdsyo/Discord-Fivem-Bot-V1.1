/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../src/locales/index.js';
import { getColor } from '../src/ui/colors.js';

vi.mock('../src/modules/fivem/lib/voice.js', () => ({
  lockVoiceChannel: vi.fn(async () => ({ ok: true })),
  setVoiceLimit: vi.fn(async () => ({ ok: true })),
  setChannelMute: vi.fn(async () => ({ changed: 3, failed: [] })),
  moveMember: vi.fn(async () => ({ ok: true })),
  pullUsers: vi.fn(async () => ({ moved: [], failed: [] })),
  voiceHumans: vi.fn(() => []),
}));

vi.mock('../src/modules/fivem/lib/presence.js', () => ({
  hasPresenceData: vi.fn(() => true),
  findOnlineByDiscordId: vi.fn(() => ({ name: 'Ahmet', id: 7 })),
  onlineCount: vi.fn(() => 5),
}));

const t = createTranslator('tr');

function makeCtx(overrides = {}) {
  const replies = [];
  const ctx = {
    t,
    args: {},
    db: { ready: true },
    user: { id: 'u1', username: 'yetkili' },
    member: {
      id: 'u1',
      voice: { channel: { id: 'vc1', type: 2, permissionsLocked: false } },
    },
    guild: { id: 'g1', name: 'Test' },
    reply: async (payload) => replies.push(payload),
    ...overrides,
  };
  return { ctx, replies };
}

function accentOf(payload) {
  const raw = payload.components[0].toJSON();
  return raw.accent_color ?? raw.accentColor;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ses-kilitle', () => {
  it('kilit yonunde warn accent kullanir', async () => {
    const command = (await import('../src/modules/fivem/commands/seskilitle.js')).default;
    const { ctx, replies } = makeCtx({ args: { durum: 'kilit' } });
    await command.run(ctx);
    expect(replies).toHaveLength(1);
    expect(accentOf(replies[0])).toBe(getColor('warn'));
    expect(JSON.stringify(replies[0])).toContain('vc1');
  });

  it('acik yonunde success accent kullanir', async () => {
    const command = (await import('../src/modules/fivem/commands/seskilitle.js')).default;
    const { ctx, replies } = makeCtx({ args: { durum: 'acik' } });
    await command.run(ctx);
    expect(accentOf(replies[0])).toBe(getColor('success'));
  });
});

describe('ses-limit', () => {
  it('limit karti success accent ve limit degerini tasir', async () => {
    const command = (await import('../src/modules/fivem/commands/seslimit.js')).default;
    const { ctx, replies } = makeCtx({ args: { limit: 5 } });
    await command.run(ctx);
    expect(accentOf(replies[0])).toBe(getColor('success'));
    expect(JSON.stringify(replies[0])).toContain('5');
  });
});

describe('herkesin-micini-kapat', () => {
  it('islem ozeti ve warn accent icerir', async () => {
    const command = (await import('../src/modules/fivem/commands/herkesinmicinikapat.js')).default;
    const { ctx, replies } = makeCtx();
    await command.run(ctx);
    expect(accentOf(replies[0])).toBe(getColor('warn'));
    const raw = JSON.stringify(replies[0]);
    expect(raw).toContain('3');
    expect(raw).toContain('vc1');
  });
});

describe('herkesin-micini-ac', () => {
  it('success accent ile ozet doner', async () => {
    const command = (await import('../src/modules/fivem/commands/herkesinmiciniac.js')).default;
    const { ctx, replies } = makeCtx();
    await command.run(ctx);
    expect(accentOf(replies[0])).toBe(getColor('success'));
  });
});

describe('oyunda-mi', () => {
  it('oyunda olan kullanici icin success kart ve oyun ismi', async () => {
    const command = (await import('../src/modules/core/commands/oyundami.js')).default;
    const { ctx, replies } = makeCtx({ args: { kullanici: { id: 'u2', user: { id: 'u2', username: 'oyuncu' } } } });
    await command.run(ctx);
    expect(replies).toHaveLength(1);
    expect(accentOf(replies[0])).toBe(getColor('success'));
    expect(JSON.stringify(replies[0])).toContain('Ahmet');
  });
});
