/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  parseDuration,
  tokenize,
  parseSnowflakeList,
  parseArgs,
  buildUsageString,
} from '../src/core/argParser.js';

// ---------------------------------------------------------------------------
// Yardimcilar: discord.js cache benzeri sahte yapilar
// ---------------------------------------------------------------------------

function makeCache(items = []) {
  const map = new Map(items.map((item) => [item.id, item]));
  map.find = (fn) => {
    for (const value of map.values()) {
      if (fn(value)) return value;
    }
    return undefined;
  };
  return map;
}

const MEMBER = {
  id: '111111111111111111',
  displayName: 'Mustafa',
  user: { id: '111111111111111111', username: 'mustafa' },
};

const ROLE = { id: '555555555555555555', name: 'Moderatör' };
const TEXT_CHANNEL = { id: '333333333333333333', name: 'genel', isVoiceBased: () => false };
const VOICE_CHANNEL = { id: '444444444444444444', name: 'sesli', isVoiceBased: () => true };

function fakeGuild({
  members = [MEMBER],
  roles = [ROLE],
  channels = [TEXT_CHANNEL, VOICE_CHANNEL],
} = {}) {
  return {
    members: {
      cache: makeCache(members),
      fetch: async () => {
        throw new Error('fetch desteklenmiyor (test)');
      },
    },
    roles: { cache: makeCache(roles) },
    channels: { cache: makeCache(channels) },
  };
}

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

describe('tokenize', () => {
  it('tirnakli metni tek token sayar', () => {
    expect(tokenize('@user "rol adı" ek bilgi')).toEqual(['@user', 'rol adı', 'ek', 'bilgi']);
  });

  it('tek ve cift tirnagi destekler', () => {
    expect(tokenize(`'tek' "çift dünya"`)).toEqual(['tek', 'çift dünya']);
  });

  it('bos girdi bos dizi doner', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize(null)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// formatDuration + parseDuration
// ---------------------------------------------------------------------------

describe('formatDuration', () => {
  it('gun/saat/dk/sn bilesenlerini yazar', () => {
    expect(formatDuration(90_000)).toBe('1 dk 30 sn');
    expect(formatDuration(86_400_000)).toBe('1 gün');
    expect(formatDuration(86_400_000 + 3_600_000 + 120_000)).toBe('1 gün 1 saat 2 dk');
  });

  it('sifir ve gecersiz girdi 0 sn doner', () => {
    expect(formatDuration(0)).toBe('0 sn');
    expect(formatDuration(-5)).toBe('0 sn');
    expect(formatDuration(NaN)).toBe('0 sn');
  });
});

describe('parseDuration', () => {
  it('birim kisaltmalarini cozer', () => {
    expect(parseDuration('30s')?.ms).toBe(30_000);
    expect(parseDuration('10m')?.ms).toBe(600_000);
    expect(parseDuration('2h')?.ms).toBe(7_200_000);
    expect(parseDuration('3d')?.ms).toBe(259_200_000);
    expect(parseDuration('1w')?.ms).toBe(604_800_000);
  });

  it('Turkce birimleri cozer', () => {
    expect(parseDuration('15sn')?.ms).toBe(15_000);
    expect(parseDuration('2sa 30dk')?.ms).toBe(9_000_000);
    expect(parseDuration('1 hafta')?.ms).toBe(604_800_000);
  });

  it('ciplak sayi DAKIKA kabul edilir', () => {
    expect(parseDuration('30')?.ms).toBe(30 * 60_000);
  });

  it('coklu birim toplanir', () => {
    expect(parseDuration('1d 2h')?.ms).toBe(93_600_000);
  });

  it('gecersiz girdiler null doner', () => {
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('10mx5')).toBeNull();
    expect(parseDuration('5.5m')).toBeNull();
    expect(parseDuration('0')).toBeNull();
    expect(parseDuration('-5')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(parseDuration(null)).toBeNull();
  });

  it('display alani bicimli metin doner', () => {
    expect(parseDuration('2sa 30dk')?.display).toBe('2 saat 30 dk');
  });
});

// ---------------------------------------------------------------------------
// parseSnowflakeList
// ---------------------------------------------------------------------------

describe('parseSnowflakeList', () => {
  it('virgul/bosluk/satir ayrimini destekler ve gecersizleri ayirir', () => {
    const { ids, invalid } = parseSnowflakeList(
      '111111111111111111, 222222222222222222\n333',
    );
    expect(ids).toEqual(['111111111111111111', '222222222222222222']);
    expect(invalid).toEqual(['333']);
  });

  it('bos girdi bos sonuc doner', () => {
    expect(parseSnowflakeList('')).toEqual({ ids: [], invalid: [] });
  });
});

// ---------------------------------------------------------------------------
// buildUsageString
// ---------------------------------------------------------------------------

describe('buildUsageString', () => {
  const ban = {
    name: 'ban',
    args: [
      { name: 'kullanici', required: true },
      { name: 'sebep', required: false },
    ],
  };

  it('slash bicimini uretir', () => {
    expect(buildUsageString(ban, '/')).toBe('/ban <kullanici> [sebep]');
  });

  it('prefix bicimini uretir', () => {
    expect(buildUsageString(ban, '.')).toBe('.ban <kullanici> [sebep]');
  });

  it('alt komutlari satir satir listeler', () => {
    const cmd = {
      name: 'ayar',
      subcommands: [
        { name: 'ac', args: [] },
        { name: 'kapat', args: [{ name: 'modul', required: true }] },
      ],
    };
    expect(buildUsageString(cmd, '/')).toBe('/ayar ac\n/ayar kapat <modul>');
  });
});

// ---------------------------------------------------------------------------
// parseArgs (resolver testleri)
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  const guild = fakeGuild();

  it('member etiketi ve kullanici adi cozulur', async () => {
    const r1 = await parseArgs({
      command: { args: [{ name: 'kisi', type: 'member', required: true }] },
      tokens: ['<@111111111111111111>'],
      guild,
    });
    expect(r1.ok).toBe(true);
    expect(r1.args.kisi).toBe(MEMBER);

    const r2 = await parseArgs({
      command: { args: [{ name: 'kisi', type: 'member', required: true }] },
      tokens: ['mustafa'],
      guild,
    });
    expect(r2.ok).toBe(true);
    expect(r2.args.kisi).toBe(MEMBER);
  });

  it('user tipi once member bulur', async () => {
    const r = await parseArgs({
      command: { args: [{ name: 'kisi', type: 'user', required: true }] },
      tokens: ['<@!111111111111111111>'],
      guild,
    });
    expect(r.ok).toBe(true);
    expect(r.args.kisi).toBe(MEMBER);
  });

  it('rol ve kanal etiketleri cozulur', async () => {
    const role = await parseArgs({
      command: { args: [{ name: 'rol', type: 'role', required: true }] },
      tokens: ['<@&555555555555555555>'],
      guild,
    });
    expect(role.args.rol).toBe(ROLE);

    const channel = await parseArgs({
      command: { args: [{ name: 'kanal', type: 'channel', required: true }] },
      tokens: ['<#333333333333333333>'],
      guild,
    });
    expect(channel.args.kanal).toBe(TEXT_CHANNEL);
  });

  it('voiceChannel metin kanalini reddeder', async () => {
    const bad = await parseArgs({
      command: { args: [{ name: 'kanal', type: 'voiceChannel', required: true }] },
      tokens: ['<#333333333333333333>'],
      guild,
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors[0]).toMatchObject({ arg: 'kanal', code: 'channel_type_mismatch' });

    const good = await parseArgs({
      command: { args: [{ name: 'kanal', type: 'voiceChannel', required: true }] },
      tokens: ['<#444444444444444444>'],
      guild,
    });
    expect(good.args.kanal).toBe(VOICE_CHANNEL);
  });

  it('integer/number/boolean cozulur, hatali deger kod doner', async () => {
    const int = await parseArgs({
      command: { args: [{ name: 'miktar', type: 'integer', required: true }] },
      tokens: ['25'],
      guild,
    });
    expect(int.args.miktar).toBe(25);

    const badInt = await parseArgs({
      command: { args: [{ name: 'miktar', type: 'integer', required: true }] },
      tokens: ['abc'],
      guild,
    });
    expect(badInt.ok).toBe(false);
    expect(badInt.errors[0]).toMatchObject({ arg: 'miktar', code: 'integer_invalid' });

    const bool = await parseArgs({
      command: { args: [{ name: 'aktif', type: 'boolean', required: true }] },
      tokens: ['evet'],
      guild,
    });
    expect(bool.args.aktif).toBe(true);

    const badBool = await parseArgs({
      command: { args: [{ name: 'aktif', type: 'boolean', required: true }] },
      tokens: ['belki'],
      guild,
    });
    expect(badBool.errors[0].code).toBe('boolean_invalid');

    // /sistemkur sıfırla -> boolean true (kurulum sifirlama anahtar sozcugu)
    const resetFlag = await parseArgs({
      command: { args: [{ name: 'sıfırla', type: 'boolean', required: false }] },
      tokens: ['sıfırla'],
      guild,
    });
    expect(resetFlag.ok).toBe(true);
    expect(resetFlag.args['sıfırla']).toBe(true);
  });

  it('duration argumani {ms, display} doner', async () => {
    const r = await parseArgs({
      command: { args: [{ name: 'sure', type: 'duration', required: true }] },
      tokens: ['10m'],
      guild,
    });
    expect(r.ok).toBe(true);
    expect(r.args.sure.ms).toBe(600_000);
  });

  it('choice tanimdan eslesir (buyuk/kucuk harf duyarsiz)', async () => {
    const r = await parseArgs({
      command: { args: [{ name: 'yon', type: 'choice', required: true, choices: ['evet', 'hayir'] }] },
      tokens: ['EVET'],
      guild,
    });
    expect(r.args.yon).toBe('evet');

    const bad = await parseArgs({
      command: { args: [{ name: 'yon', type: 'choice', required: true, choices: ['evet', 'hayir'] }] },
      tokens: ['belki'],
      guild,
    });
    expect(bad.errors[0].code).toBe('choice_invalid');
  });

  it('rest son arguman kalan tum tokenlari tuketir', async () => {
    const r = await parseArgs({
      command: {
        args: [
          { name: 'kisi', type: 'member', required: true },
          { name: 'sebep', type: 'rest', required: false },
        ],
      },
      tokens: ['mustafa', 'çok', 'uzun', 'bir sebep'],
      guild,
    });
    expect(r.args.sebep).toBe('çok uzun bir sebep');
  });

  it('snowflakeList son arguman ID listesi doner', async () => {
    const r = await parseArgs({
      command: { args: [{ name: 'idler', type: 'snowflakeList', required: true }] },
      tokens: ['111111111111111111', '222222222222222222'],
      guild,
    });
    expect(r.args.idler).toEqual(['111111111111111111', '222222222222222222']);

    const empty = await parseArgs({
      command: { args: [{ name: 'idler', type: 'snowflakeList', required: true }] },
      tokens: ['abc'],
      guild,
    });
    expect(empty.errors[0].code).toBe('snowflake_list_empty');
  });

  it('zorunlu arguman eksikse required_missing doner', async () => {
    const r = await parseArgs({
      command: { args: [{ name: 'kullanici', type: 'member', required: true }] },
      tokens: [],
      guild,
    });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatchObject({ arg: 'kullanici', code: 'required_missing' });
  });

  it('fazla tokenlar __extra altinda toplanir', async () => {
    const r = await parseArgs({
      command: { args: [{ name: 'miktar', type: 'integer', required: true }] },
      tokens: ['5', 'fazla', 'token'],
      guild,
    });
    expect(r.args.__extra).toEqual(['fazla', 'token']);
  });
});
