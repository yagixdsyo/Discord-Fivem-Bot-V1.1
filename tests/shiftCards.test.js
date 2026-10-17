/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../src/locales/index.js';

const STARTED_AT = new Date(Date.now() - 3600_000).toISOString();
const ENDED_AT = new Date().toISOString();

vi.mock('../src/modules/shift/lib/shifts.js', () => ({
  findActiveShift: vi.fn(async () => null),
  startShift: vi.fn(async () => ({ ok: true, doc: { shift_id: 's-test-1', started_at: STARTED_AT } })),
  endShift: vi.fn(async () => ({
    ok: true,
    doc: { shift_id: 's-test-1', started_at: STARTED_AT, ended_at: ENDED_AT },
    durationSeconds: 3720,
  })),
  formatDuration: (seconds) => `${Math.floor(Number(seconds) / 60)} dk`,
  listActiveShifts: vi.fn(async () => [
    { user_id: 'u1', started_at: STARTED_AT },
    { user_id: 'u2', started_at: STARTED_AT },
  ]),
  createUnit: vi.fn(async ({ name }) => ({ unit_id: 'b-1', name })),
  listUnits: vi.fn(async () => []),
  deactivateUnit: vi.fn(async () => true),
  addUnitMember: vi.fn(async () => true),
  removeUnitMember: vi.fn(async () => true),
  updateUnitNote: vi.fn(async () => true),
  adjustShift: vi.fn(async () => ({ ok: true, active: true })),
}));

const t = createTranslator('tr');
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

function isPng(buffer) {
  return Buffer.isBuffer(buffer) && PNG_MAGIC.every((byte, index) => buffer[index] === byte);
}

function makeCtx({ member = null } = {}) {
  const replies = [];
  const ctx = {
    t,
    db: { ready: true },
    args: {},
    user: { id: 'u1', username: 'memur' },
    member: member ?? {
      id: 'u1',
      nickname: 'memur',
      permissions: { has: () => true },
      manageable: true,
      voice: { channel: { id: 'vc1' } },
    },
    guild: {
      id: 'g1',
      name: 'Test',
      members: {
        cache: new Map(),
        fetch: async (id) =>
          id === 'u1'
            ? {
                displayName: 'memur',
                voice: { channel: { id: 'vc1' } },
                user: { username: 'memur', displayAvatarURL: () => null },
              }
            : null,
      },
    },
    reply: async (payload) => replies.push(payload),
    followUp: async (payload) => replies.push(payload),
  };
  return { ctx, replies };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mesaiye-gir', () => {
  it('baslangic karti uretir (footer shift id)', async () => {
    const command = (await import('../src/modules/shift/commands/mesaiye-gir.js')).default;
    const { ctx, replies } = makeCtx();
    await command.run(ctx);
    expect(replies).toHaveLength(1);
    const raw = JSON.stringify(replies[0]);
    expect(raw).toContain('s-test-1');
    expect(raw).toContain('Mesai Başladı');
    expect(raw).toContain('/mesaiden-cik');
  });
});

describe('mesaiden-cik', () => {
  it('sure ozetli kapanis karti uretir', async () => {
    const command = (await import('../src/modules/shift/commands/mesaiden-cik.js')).default;
    const { ctx, replies } = makeCtx();
    await command.run(ctx);
    expect(replies).toHaveLength(1);
    const raw = JSON.stringify(replies[0]);
    expect(raw).toContain('62 dk');
    expect(raw).toContain('s-test-1');
    expect(raw).toContain('Mesai Bitti');
  });
});

describe('aktifmemurlar', () => {
  it('canvas liderlik tablosu gonderir (toplu cikar butonu ile)', async () => {
    const command = (await import('../src/modules/shift/commands/aktifmemurlar.js')).default;
    const { ctx, replies } = makeCtx();
    await command.run(ctx);
    expect(replies).toHaveLength(1);
    const payload = replies[0];
    expect(payload.files).toHaveLength(1);
    expect(isPng(payload.files[0].attachment)).toBe(true);
    const raw = JSON.stringify(payload);
    expect(raw).toContain('mesaibuton:toplu-cikar:u1');
  });
});

describe('ses-aktif', () => {
  it('kart ile kanal ve sure listeler', async () => {
    const command = (await import('../src/modules/shift/commands/ses-aktif.js')).default;
    const { ctx, replies } = makeCtx();
    await command.run(ctx);
    expect(replies).toHaveLength(1);
    const raw = JSON.stringify(replies[0]);
    expect(raw).toContain('Aktif Ses Yetkilileri');
    expect(raw).toContain('<#vc1>');
    expect(raw).toContain('60 dk');
  });
});

describe('birim', () => {
  it('kur islemi birim karti uretir', async () => {
    const command = (await import('../src/modules/shift/commands/birim.js')).default;
    const { ctx, replies } = makeCtx();
    ctx.args = { islem: 'kur', ad: 'Devriye A' };
    await command.run(ctx);
    expect(replies).toHaveLength(1);
    const raw = JSON.stringify(replies[0]);
    expect(raw).toContain('b-1');
    expect(raw).toContain('Devriye A');
  });
});

describe('locale anahtarlari', () => {
  it('yeni anahtarlar cozulur', () => {
    const keys = [
      'shift.started_time',
      'shift.started_hint',
      'shift.ended_duration',
      'shift.ended_range',
      'mesai.active_voice_line',
      'mesai.active_voice_subtitle',
    ];
    for (const key of keys) {
      const value = t(key);
      expect(String(value)).not.toBe(key);
      expect(String(value).length).toBeGreaterThan(0);
    }
  });
});
