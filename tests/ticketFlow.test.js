/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../src/locales/index.js';

vi.mock('../src/modules/moderation/lib/transcript.js', () => ({
  collectForDelete: vi.fn(async () => ({ messages: [{}, {}] })),
  buildTranscriptHtml: vi.fn(() => '<html>transcript</html>'),
  uploadTranscript: vi.fn(async () => null),
}));

vi.mock('../src/modules/ticket/lib/tickets.js', () => ({
  closeTicket: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../src/modules/fivem/lib/maps.js', () => ({
  getChannelId: vi.fn(async (guildId, key) => (key === 'log_ticket_transcript' ? 'log-1' : null)),
}));

const t = createTranslator('tr');

describe('ticket paneli', () => {
  it('7 ana kategori icin sag buton tasir ve ayraclarla ayrilir', async () => {
    const { buildTicketPanel } = await import('../src/modules/ticket/lib/panel.js');
    const payload = buildTicketPanel(t);
    const json = JSON.stringify(payload);
    for (const category of ['destek', 'bug', 'banitiraz', 'sikayet', 'donate', 'basvuru', 'diger']) {
      expect(json, `${category} butonu yok`).toContain(`ticket:ac:${category}`);
    }
    expect(json).toContain('Talep Aç');
    // Ek kategori secim menusu
    expect(json).toContain('ticket:ac');
    expect(json).toContain('hile');
    expect(json).toContain('meslek');
    // Container accent primary
    const raw = payload.components[0].toJSON();
    expect(raw.accent_color ?? raw.accentColor).toBeTruthy();
  });

  it('panel yeni locale anahtarlarini kullanir', () => {
    expect(t('ticket.panel_open_button')).toBe('Talep Aç');
    expect(t('ticket.panel_more_placeholder')).toContain('Diğer kategoriler');
    expect(t('ticket.panel_footer')).toContain('kategori');
    expect(t('ticket.category_desc.bug')).toContain('bug');
    expect(t('ticket.category_desc.sikayet')).toContain('şikayet');
  });
});

describe('ticket kapatma akisi', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('transcript uretir, log kanalina yollar, kanali kilitler ve siler', async () => {
    const { finalizeTicketClose } = await import('../src/modules/ticket/lib/closeFlow.js');

    const channel = {
      name: 'ticket-1',
      permissionOverwrites: { edit: vi.fn(async () => {}) },
      send: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
    };
    const logCh = { send: vi.fn(async () => {}) };
    const guild = {
      id: 'g1',
      name: 'Sunucu',
      channels: {
        cache: new Map([
          ['c1', channel],
          ['log-1', logCh],
        ]),
        fetch: vi.fn(async (id) => (id === 'c1' ? channel : logCh)),
      },
    };
    const dmSend = vi.fn(async () => {});
    const client = { users: { fetch: vi.fn(async () => ({ send: dmSend })) } };

    const doc = { ticket_id: 't-1', channel_id: 'c1', user_id: 'u1', category: 'destek' };
    const result = await finalizeTicketClose({ guild, client, doc, by: 's1', reason: 'yetkili', t });

    expect(result.ok).toBe(true);
    expect(result.logChannelId).toBe('log-1');
    expect(result.messageCount).toBe(2);
    // Log kanalina transcript dosyasi ile gitti
    expect(logCh.send).toHaveBeenCalledOnce();
    const logPayload = logCh.send.mock.calls[0][0];
    expect(logPayload.files).toHaveLength(1);
    expect(JSON.stringify(logPayload)).toContain('t-1');
    // Kanalda uye kilitlendi + banner atildi
    expect(channel.permissionOverwrites.edit).toHaveBeenCalled();
    expect(channel.send).toHaveBeenCalled();
    // DM puanlama
    expect(client.users.fetch).toHaveBeenCalledWith('u1');
    expect(dmSend).toHaveBeenCalled();
    // Gecikmeli silme
    expect(channel.delete).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(channel.delete).toHaveBeenCalledOnce();
  });

  it('log kanali ayarlanmamissa yine kapatir (logChannelId null)', async () => {
    const { getChannelId } = await import('../src/modules/fivem/lib/maps.js');
    getChannelId.mockResolvedValueOnce(null);
    const { finalizeTicketClose } = await import('../src/modules/ticket/lib/closeFlow.js');

    const channel = {
      name: 'ticket-2',
      permissionOverwrites: { edit: vi.fn(async () => {}) },
      send: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
    };
    const guild = { id: 'g1', name: 'S', channels: { cache: new Map([['c2', channel]]), fetch: vi.fn(async () => channel) } };
    const client = { users: { fetch: vi.fn(async () => ({ send: vi.fn(async () => {}) })) } };
    const doc = { ticket_id: 't-2', channel_id: 'c2', user_id: 'u2', category: 'bug' };

    const result = await finalizeTicketClose({ guild, client, doc, by: 's1', reason: 'yetkili', t });
    expect(result.ok).toBe(true);
    expect(result.logChannelId).toBeNull();
    vi.runAllTimers();
    expect(channel.delete).toHaveBeenCalledOnce();
  });
});
