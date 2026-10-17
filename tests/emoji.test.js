/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

process.env.LOG_LEVEL = 'silent'; // eksik anahtar uyarilari test ciktisini kirletmesin

import { describe, it, expect } from 'vitest';
import {
  initEmoji,
  emoji,
  emojiTag,
  emojiObj,
  emojiOr,
  emojiReport,
} from '../src/ui/emoji.js';

initEmoji({
  source: 'guild',
  guildId: '123456789012345678',
  map: {
    BASARI: { id: '111111111111111111', animated: false },
    YUKLENIYOR: { id: '222222222222222222', animated: true },
    OYUN: { text: '🎮' },
  },
  missingKeys: ['EKSIK_KALAN'],
});

describe('emoji', () => {
  it('statik emoji <:isim:id> biciminde doner', () => {
    expect(emoji('BASARI')).toBe('<:basari:111111111111111111>');
  });

  it('animasyonlu emoji <a:isim:id> biciminde doner', () => {
    expect(emoji('YUKLENIYOR')).toBe('<a:yukleniyor:222222222222222222>');
  });

  it('emojiTag emoji ile ayni sonucu doner', () => {
    expect(emojiTag('BASARI')).toBe(emoji('BASARI'));
  });

  it('eksik anahtar bos string doner (hata firlatmaz)', () => {
    expect(emoji('YOK_BOYLE_BIRSEY')).toBe('');
    expect(emoji('YOK_BOYLE_BIRSEY')).toBe('');
  });

  it('emojiOr eksik anahtarda alternatif gosterir', () => {
    expect(emojiOr('YOK_BOYLE_BIRSEY', '•')).toBe('•');
    expect(emojiOr('BASARI', '•')).toBe('<:basari:111111111111111111>');
  });

  it('unicode (metin) emoji oldugu gibi doner', () => {
    expect(emoji('OYUN')).toBe('🎮');
    expect(emojiTag('OYUN')).toBe('🎮');
    expect(emojiOr('OYUN', '•')).toBe('🎮');
  });
});

describe('emojiObj', () => {
  it('buton/select icin {id, name, animated} doner', () => {
    expect(emojiObj('BASARI')).toEqual({
      id: '111111111111111111',
      name: 'basari',
      animated: false,
    });
    expect(emojiObj('YUKLENIYOR')).toEqual({
      id: '222222222222222222',
      name: 'yukleniyor',
      animated: true,
    });
  });

  it('eksik anahtarda undefined doner', () => {
    expect(emojiObj('YOK_BOYLE_BIRSEY')).toBeUndefined();
  });

  it('unicode emoji icin yalnizca { name } doner', () => {
    expect(emojiObj('OYUN')).toEqual({ name: '🎮' });
  });
});

describe('emojiReport', () => {
  it('doldurulan ve eksik anahtar ozetini verir', () => {
    const report = emojiReport();
    expect(report.source).toBe('guild');
    expect(report.guildId).toBe('123456789012345678');
    expect(report.filled).toBe(3);
    expect(report.total).toBe(4);
    expect(report.missingKeys).toContain('EKSIK_KALAN');
  });
});
