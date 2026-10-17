/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import { parseEnv, EnvValidationError } from '../src/core/env.js';
import { EMOJI_KEYS } from '../src/ui/emojiKeys.js';

/** Gecerli minimum ortam (bot tokeni olmadan). */
function baseEnv(extra = {}) {
  return {
    MONGO_URI: 'mongodb://localhost:27017',
    REDIS_URL: 'redis://localhost:6379',
    OWNER_IDS: '123456789012345678',
    ...extra,
  };
}

describe('parseEnv - temel', () => {
  it('gecerli ortamdan config uretir ve varsayilanlari uygular', () => {
    const { config } = parseEnv(baseEnv({ BOT_TOKEN: 'test-token' }));
    expect(config.prefix).toBe('.');
    expect(config.timezone).toBe('Europe/Istanbul');
    expect(config.ownerIds).toEqual(['123456789012345678']);
    expect(config.bots).toHaveLength(1);
    expect(config.bots[0].type).toBe('fivem');
    expect(config.mongo.dbName).toBe('fivem_bot');
    expect(config.healthPort).toBe(3000);
    expect(config.colors.primary).toBe('#5865F2');
    expect(config.emoji.source).toBe('guild');
  });

  it('bot tokeni yoksa hata firlatir (zorunlu mod)', () => {
    expect(() => parseEnv(baseEnv())).toThrow(EnvValidationError);
  });

  it('requireBots=false iken bot tokeni olmadan da calisir (migration CLI)', () => {
    const { config } = parseEnv(baseEnv(), { requireBots: false });
    expect(config.bots).toHaveLength(0);
  });

  it('cok botlu kurulumda tip basina token ayristirilir', () => {
    const { config } = parseEnv(
      baseEnv({
        BOT_FIVEM_TOKEN: 'tok-fivem',
        BOT_PUBLIC_TOKEN: 'tok-public',
        BOT_GUARD_TOKEN: 'tok-guard',
      }),
      { requireBots: true },
    );
    expect(config.bots.map((b) => b.type).sort()).toEqual(['fivem', 'guard', 'public']);
  });

  it('ayni token iki kez tanimlanirsa tek bot olusturulur', () => {
    const { config } = parseEnv(
      baseEnv({ BOT_TOKEN: 'aynı-token', BOT_FIVEM_TOKEN: 'aynı-token' }),
      { requireBots: true },
    );
    expect(config.bots).toHaveLength(1);
  });

  it('MONGO_URI eksikse hata firlatir', () => {
    const env = baseEnv({ BOT_TOKEN: 't' });
    delete env.MONGO_URI;
    expect(() => parseEnv(env)).toThrow(EnvValidationError);
  });
});

describe('parseEnv - emojiler', () => {
  it('eksik emoji anahtarlarini warning listesinde doner, hata firlatmaz', () => {
    const { config, warnings } = parseEnv(baseEnv({ BOT_TOKEN: 't' }));
    const summary = warnings.find((w) => w.includes('Eksik emoji anahtarlari'));
    expect(summary).toBeTruthy();
    expect(config.emoji.missingKeys.length).toBe(EMOJI_KEYS.length);
    expect(config.emoji.map).toEqual({});
  });

  it('dolu emoji anahtarini map e aktarir, eksikleri ayri listeler', () => {
    const { config } = parseEnv(
      baseEnv({ BOT_TOKEN: 't', EMOJI_BASARI: '123456789012345678' }),
    );
    expect(config.emoji.map.BASARI).toEqual({ id: '123456789012345678', animated: false });
    expect(config.emoji.missingKeys).not.toContain('BASARI');
    expect(config.emoji.missingKeys).toContain('HATA');
  });

  it('animasyonlu varsayilan: EMOJI_YUKLENIYOR animasyonlu, _ANIM=false ile kapanir', () => {
    const a = parseEnv(baseEnv({ BOT_TOKEN: 't', EMOJI_YUKLENIYOR: '111111111111111111' }));
    expect(a.config.emoji.map.YUKLENIYOR.animated).toBe(true);

    const b = parseEnv(
      baseEnv({
        BOT_TOKEN: 't',
        EMOJI_YUKLENIYOR: '111111111111111111',
        EMOJI_YUKLENIYOR_ANIM: 'false',
      }),
    );
    expect(b.config.emoji.map.YUKLENIYOR.animated).toBe(false);
  });

  it('gecersiz emoji ID si yok sayilir ve warning uretir', () => {
    const { config, warnings } = parseEnv(
      baseEnv({ BOT_TOKEN: 't', EMOJI_BASARI: 'bu-bir-id-degil' }),
    );
    expect(config.emoji.map.BASARI).toBeUndefined();
    expect(warnings.some((w) => w.includes('Gecersiz emoji'))).toBe(true);
  });

  it('unicode (metin) emoji kabul edilir; ID gerekmez', () => {
    const { config, warnings } = parseEnv(
      baseEnv({ BOT_TOKEN: 't', EMOJI_OYUN: '🎮', EMOJI_ZAR: '🎲' }),
    );
    expect(config.emoji.map.OYUN).toEqual({ text: '🎮' });
    expect(config.emoji.map.ZAR).toEqual({ text: '🎲' });
    expect(config.emoji.missingKeys).not.toContain('OYUN');
    expect(warnings.some((w) => w.includes('Gecersiz emoji'))).toBe(false);
  });

  it('Discord etiketi (<:isim:id>) kabul edilir ve ID ayiklanir', () => {
    const { config, warnings } = parseEnv(
      baseEnv({
        BOT_TOKEN: 't',
        EMOJI_BASARI: '<:online:1546118465876795462>',
        EMOJI_HATA: '<:mcs_carpi:1546116439470116945>',
      }),
    );
    expect(config.emoji.map.BASARI).toEqual({ id: '1546118465876795462', animated: false });
    expect(config.emoji.map.HATA).toEqual({ id: '1546116439470116945', animated: false });
    expect(warnings.some((w) => w.includes('Gecersiz emoji'))).toBe(false);
  });

  it('animasyonlu etiket (<a:isim:id>) animasyon bayragini otomatik ayarlar', () => {
    const auto = parseEnv(baseEnv({ BOT_TOKEN: 't', EMOJI_UYARI: '<a:unlem:1546497724441043084>' }));
    expect(auto.config.emoji.map.UYARI).toEqual({ id: '1546497724441043084', animated: true });

    // Acik _ANIM=false etiketten gelen otomatik degeri gecersiz kilar.
    const capped = parseEnv(
      baseEnv({
        BOT_TOKEN: 't',
        EMOJI_UYARI: '<a:unlem:1546497724441043084>',
        EMOJI_UYARI_ANIM: 'false',
      }),
    );
    expect(capped.config.emoji.map.UYARI.animated).toBe(false);

    // Statik etiket, animasyonlu varsayilanli anahtari (YUKLENIYOR) statige cevirir.
    const plain = parseEnv(
      baseEnv({ BOT_TOKEN: 't', EMOJI_YUKLENIYOR: '<:tick:1546116546114486362>' }),
    );
    expect(plain.config.emoji.map.YUKLENIYOR).toEqual({ id: '1546116546114486362', animated: false });
  });

  it('bozuk etiket gecersiz sayilir', () => {
    const { config, warnings } = parseEnv(
      baseEnv({ BOT_TOKEN: 't', EMOJI_BASARI: '<:online:abc>' }),
    );
    expect(config.emoji.map.BASARI).toBeUndefined();
    expect(warnings.some((w) => w.includes('Gecersiz emoji'))).toBe(true);
  });

  it('guild kaynagi seciliyken EMOJI_GUILD_ID bos ise uyarir', () => {
    const { warnings } = parseEnv(baseEnv({ BOT_TOKEN: 't', EMOJI_SOURCE: 'guild' }));
    expect(warnings.some((w) => w.includes('EMOJI_GUILD_ID bos'))).toBe(true);
  });
});

describe('parseEnv - renkler ve owner', () => {
  it('gecersiz renk hex i varsayilana doner ve uyarir', () => {
    const { config, warnings } = parseEnv(
      baseEnv({ BOT_TOKEN: 't', COLOR_PRIMARY: 'mavi' }),
    );
    expect(config.colors.primary).toBe('#5865F2');
    expect(warnings.some((w) => w.includes('COLOR_PRIMARY'))).toBe(true);
  });

  it('OWNER_IDS icinde gecersiz deger varsa yok sayilir', () => {
    const { config, warnings } = parseEnv(
      baseEnv({ BOT_TOKEN: 't', OWNER_IDS: '123456789012345678,abc,987654321098765432' }),
    );
    expect(config.ownerIds).toEqual(['123456789012345678', '987654321098765432']);
    expect(warnings.some((w) => w.includes('abc'))).toBe(true);
  });

  it('OWNER_IDS bos ise owner komutlarinin kapali oldugu uyarilir', () => {
    const { warnings } = parseEnv(baseEnv({ BOT_TOKEN: 't', OWNER_IDS: '' }));
    expect(warnings.some((w) => w.includes('OWNER_IDS bos'))).toBe(true);
  });
});
