/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import { renderWelcomePng, renderGoodbyePng, renderLeaderboardPng, renderProfilePng } from '../src/ui/canvas/cards.js';
import { card } from '../src/ui/templates/base.js';
import { getWelcomeConfig, sendGoodbye, sendWelcome } from '../src/modules/moderation/lib/welcome.js';
import { createTranslator } from '../src/locales/index.js';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

function isPng(buffer) {
  return Buffer.isBuffer(buffer) && PNG_MAGIC.every((byte, index) => buffer[index] === byte);
}

describe('canvas kartlari', () => {
  it('hos geldin karti PNG uretir', async () => {
    const png = await renderWelcomePng({
      tag: 'mustafa',
      subtitle: 'Test sunucusuna katıldın!',
      metaLine: 'Üye: 42',
      avatarUrl: null,
    });
    expect(isPng(png)).toBe(true);
  });

  it('gule gule karti PNG uretir (avatarsiz yedek daire)', async () => {
    const png = await renderGoodbyePng({ tag: 'mustafa', subtitle: 'Test sunucusundan ayrıldın.' });
    expect(isPng(png)).toBe(true);
  });

  it('liderlik tablosu PNG uretir', async () => {
    const png = await renderLeaderboardPng({
      title: 'Oyun Lider Tablosu',
      subtitle: 'En iyi 3 oyuncu',
      items: [
        { name: 'oyuncu1', valueText: '120' },
        { name: 'oyuncu2', valueText: '90' },
        { name: 'oyuncu3', valueText: '75' },
      ],
    });
    expect(isPng(png)).toBe(true);
  });

  it('profil karti PNG uretir', async () => {
    const png = await renderProfilePng({
      title: 'mustafa',
      subtitle: '@mustafa',
      stats: [
        { label: 'Oluşturma', value: '01.01.2024' },
        { label: 'Katılma', value: '05.05.2024' },
        { label: 'Aktif ceza', value: '0' },
      ],
    });
    expect(isPng(png)).toBe(true);
  });

  it('card() imageUrls ile galeri bileseni ekler ve dosyalari tasir', () => {
    const payload = card({
      title: 'Test',
      lines: ['satir'],
      imageUrls: ['attachment://test.png'],
      files: [{ name: 'test.png' }],
    });
    const raw = payload.components[0].toJSON();
    const types = raw.components.map((child) => child.type);
    expect(types).toContain(12); // MediaGallery
    expect(payload.files).toHaveLength(1);
  });
});

describe('hg/bb yapilandirmasi', () => {
  it('getWelcomeConfig varsayilanlarda veda alanlari dolu', async () => {
    const cfg = await getWelcomeConfig('g-test');
    expect(cfg.byeChannelId).toBeNull();
    expect(typeof cfg.byeMessage).toBe('string');
    expect(cfg.byeMessage.length).toBeGreaterThan(0);
    expect(cfg.language).toBe('tr');
  });

  it('sendGoodbye kanal ayarli degilse ok:false doner', async () => {
    const member = { id: 'u1', guild: { id: 'g1', name: 'Test', channels: { cache: new Map(), fetch: async () => null } } };
    const result = await sendGoodbye(member, { byeChannelId: null, byeMessage: 'Görüşürüz', language: 'tr' });
    expect(result.ok).toBe(false);
  });

  it('sendWelcome kanal/DM kapaliysa canvas uretir ama gondermez', async () => {
    const member = {
      id: 'u2',
      user: { username: 'test', displayAvatarURL: () => null },
      guild: {
        id: 'g1',
        name: 'Test Sunucusu',
        memberCount: 10,
        channels: { cache: new Map(), fetch: async () => null },
        members: { cache: { size: 10 } },
      },
    };
    const result = await sendWelcome(member, {
      channelId: null,
      dm: false,
      message: 'Hoş geldin {kullanici}!',
      byeChannelId: null,
      byeMessage: 'x',
      language: 'tr',
    });
    expect(result.ok).toBe(false);
    expect(result.channel).toBe(false);
  });
});

describe('locale anahtarlari', () => {
  it('yeni anahtarlar cozulur', () => {
    const t = createTranslator('tr');
    const keys = [
      'moderation.welcome.title',
      'moderation.welcome.canvas_subtitle',
      'moderation.welcome.canvas_member',
      'moderation.welcome.bye_title',
      'moderation.welcome.bye_canvas_subtitle',
      'moderation.autorole.bye_channel',
      'moderation.autorole.bye_message',
      'moderation.autorole.changed_bye_channel',
      'moderation.autorole.changed_bye_message',
      'moderation.autorole.changed_bye_off',
      'moderation.server.canvas_subtitle',
      'shift.info_active_label',
      'shift.info_total_label',
      'shift.info_leave_label',
      'fun.leaderboard_subtitle',
      'fun.leaderboard_unknown',
      'fun.score_label_delta',
      'fun.score_label_total',
      'fun.score_label_rank',
    ];
    for (const key of keys) {
      const value = t(key);
      expect(String(value)).not.toBe(key);
      expect(String(value).length).toBeGreaterThan(0);
    }
  });
});

describe('skor-puan canvas', () => {
  it('puan guncellemesi canvas kart (dosya eki) ile doner', async () => {
    const command = (await import('../src/modules/fun/commands/skor-puan.js')).default;
    const replies = [];
    const target = { id: 'u-canvas-1', username: 'oyuncu', displayAvatarURL: () => null };
    const ctx = {
      t: createTranslator('tr'),
      args: { kullanici: { user: target }, puan: 5 },
      guild: { id: 'g-score-canvas', members: { cache: new Map(), fetch: async () => null } },
      reply: async (payload) => {
        replies.push(payload);
      },
    };
    await command.run(ctx);
    expect(replies).toHaveLength(1);
    expect(replies[0].files).toHaveLength(1);
  });
});
