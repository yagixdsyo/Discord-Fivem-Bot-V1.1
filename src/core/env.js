/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import dotenv from 'dotenv';
import { z } from 'zod';
import { EMOJI_KEYS, ANIMATED_BY_DEFAULT, emojiEnvKey, emojiAnimEnvKey } from '../ui/emojiKeys.js';

/**
 * Ortam degiskeni dogrulamasi.
 *
 * Kurallar:
 * - Zorunlu alanlar (DB, Redis, en az bir bot tokeni) yoksa bot baslatilmaz:
 *   net Turkce hata listesi ile EnvValidationError firlatilir.
 * - Eksik emoji anahtarlari botu DURDURMAZ; warning listesine eklenir ve
 *   acilista konsola + owner log kanalina raporlanir.
 * - EMOJI_<ANAHTAR> degeri duz ID olabilir ya da Discord'dan kopyalanan
 *   <:isim:id> / <a:isim:id> etiketi olabilir; etiketteki animasyon bayragi
 *   otomatik algilanir (EMOJI_<ANAHTAR>_ANIM her zaman ustune yazar).
 * - Duz unicode (yerlesik) emoji metni de kabul edilir (or. \u{1F3AE}); ID gerektirmez
 *   ve Discord kaynak dogrulamasina girmez.
 */

export class EnvValidationError extends Error {
  constructor(issues) {
    const lines = issues.map((i) => `  - ${i.path || '(kok)'}: ${i.message}`);
    super(`Ortam dogrulamasi basarisiz:\n${lines.join('\n')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

const SNOWFLAKE_RE = /^\d{5,25}$/;
const HEX_COLOR_RE = /^#?[0-9A-Fa-f]{6}$/;
/** Discord emoji etiketi: <:isim:id> (statik) veya <a:isim:id> (animasyonlu). */
const EMOJI_TAG_RE = /^<a?:[A-Za-z0-9_]+:(\d{5,25})>$/;
/** Unicode (yerlesik) emoji: en az bir pictographic karakter veya keycap isareti icerir. */
const UNICODE_EMOJI_RE = /[\p{Extended_Pictographic}\u{20E3}]/u;

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

function csvSnowflakes(raw) {
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeColor(value, fallback) {
  const v = String(value ?? '').trim();
  if (!v) return fallback;
  return HEX_COLOR_RE.test(v) ? (v.startsWith('#') ? v.toUpperCase() : `#${v.toUpperCase()}`) : null;
}

/** Temel (emoji haric) sema. */
function buildBaseSchema() {
  return {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    DEFAULT_PREFIX: z.string().min(1).max(3).default('.'),
    DEFAULT_TIMEZONE: z.string().min(1).default('Europe/Istanbul'),

    OWNER_IDS: z.string().optional().default(''),
    DEV_GUILD_ID: z.string().optional().default('').refine((v) => v === '' || SNOWFLAKE_RE.test(v), {
      message: 'Gecerli bir snowflake ID olmali (bos birakilabilir)',
    }),

    BOT_TOKEN: z.string().optional().default(''),
    BOT_FIVEM_TOKEN: z.string().optional().default(''),
    BOT_PUBLIC_TOKEN: z.string().optional().default(''),
    BOT_GUARD_TOKEN: z.string().optional().default(''),
    BOT_TICKET_TOKEN: z.string().optional().default(''),
    BOT_YETKIKONTROL_TOKEN: z.string().optional().default(''),
    ENABLE_PRESENCE_INTENT: z.enum(['true', 'false']).default('true'),

    MONGO_URI: z
      .string({ error: 'MONGO_URI zorunludur (orn: mongodb://kullanici:sifre@host:27017/?authSource=admin)' })
      .min(1, 'MONGO_URI bos olamaz'),
    MONGO_DB_NAME: z.string().min(1).default('fivem_bot'),
    REDIS_URL: z
      .string({ error: 'REDIS_URL zorunludur (orn: redis://localhost:6379)' })
      .min(1, 'REDIS_URL bos olamaz'),
    HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    OWNER_LOG_GUILD_ID: z.string().optional().default(''),
    OWNER_LOG_CHANNEL_ID: z.string().optional().default(''),

    FIVEM_CFX_CODE: z.string().optional().default(''),
    FIVEM_IP: z
      .string()
      .optional()
      .default('')
      .refine((v) => v === '' || /^[A-Za-z0-9.:_-]{3,64}$/.test(v), {
        message: 'Gecerli bir IP/host olmali (bos birakilabilir)',
      }),
    FIVEM_WH_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    NVIDIA_API_KEY: z.string().optional().default(''),
    NVIDIA_BASE_URL: z.string().default('https://integrate.api.nvidia.com/v1').refine((v) => /^https?:\/\//.test(v), { message: 'Gecerli bir URL olmali' }),
    NVIDIA_MODEL: z.string().min(1).default('meta/llama-4-maverick-17b-128e-instruct'),
    NVIDIA_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(20000),
    NVIDIA_RATE_LIMIT_SECONDS: z.coerce.number().int().min(5).max(600).default(30),
    NVIDIA_MAX_TOKENS: z.coerce.number().int().min(64).max(4096).default(900),
    SITE_API_BASE_URL: z.string().default('').refine((v) => v === '' || /^https?:\/\//.test(v), { message: 'Gecerli bir URL olmali (bos birakilabilir)' }),
    SITE_API_TOKEN: z.string().optional().default(''),
    SITE_API_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
    SITE_UPLOAD_BASE_URL: z.string().default('').refine((v) => v === '' || /^https?:\/\//.test(v), { message: 'Gecerli bir URL olmali (bos birakilabilir)' }),
    SITE_UPLOAD_TOKEN: z.string().optional().default(''),

    EMOJI_SOURCE: z.enum(['application', 'guild']).default('guild'),
    EMOJI_GUILD_ID: z.string().optional().default(''),

    COLOR_PRIMARY: z.string().optional().default('#5865F2'),
    COLOR_SUCCESS: z.string().optional().default('#57F287'),
    COLOR_ERROR: z.string().optional().default('#ED4245'),
    COLOR_WARN: z.string().optional().default('#FEE75C'),
    COLOR_INFO: z.string().optional().default('#3B82F6'),
  };
}

/** Emoji alanlarini kayit dosyasindan dinamik uretir. */
function buildEmojiShape() {
  const shape = {};
  for (const key of EMOJI_KEYS) {
    shape[emojiEnvKey(key)] = z.string().optional().default('');
    shape[emojiAnimEnvKey(key)] = z.enum(['true', 'false']).optional();
  }
  return shape;
}

/**
 * Ham ortam nesnesini dogrular ve uygulama config'ini uretir (yan etkisiz, test edilebilir).
 * @param {Record<string, unknown>} raw
 * @param {{ requireBots?: boolean }} [opts]
 * @returns {{ config: object, warnings: string[] }}
 */
export function parseEnv(raw, { requireBots = true } = {}) {
  const schema = z.object({ ...buildBaseSchema(), ...buildEmojiShape() });
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    throw new EnvValidationError(
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }

  const data = parsed.data;
  const warnings = [];

  // --- Bot tokenlari ---
  const bots = [];
  const seenTokens = new Set();
  const typeTokens = [
    ['fivem', data.BOT_FIVEM_TOKEN, 'fivem'],
    ['public', data.BOT_PUBLIC_TOKEN, 'public'],
    ['guard', data.BOT_GUARD_TOKEN, 'guard'],
    ['ticket', data.BOT_TICKET_TOKEN, 'ticket'],
    ['yetkikontrol', data.BOT_YETKIKONTROL_TOKEN, 'yetkikontrol'],
  ];
  if (data.BOT_TOKEN) {
    bots.push({ type: 'fivem', label: 'varsayilan', token: data.BOT_TOKEN });
    seenTokens.add(data.BOT_TOKEN);
  }
  for (const [type, token, label] of typeTokens) {
    if (token && !seenTokens.has(token)) {
      bots.push({ type, label, token });
      seenTokens.add(token);
    }
  }
  if (requireBots && bots.length === 0) {
    throw new EnvValidationError([
      {
        path: 'BOT_TOKEN',
        message:
          'En az bir bot tokeni zorunludur (BOT_TOKEN veya BOT_<TIP>_TOKEN). .env dosyanizi kontrol edin.',
      },
    ]);
  }

  // --- Owner ID'leri ---
  const ownerIds = csvSnowflakes(data.OWNER_IDS);
  const invalidOwners = ownerIds.filter((id) => !SNOWFLAKE_RE.test(id));
  if (invalidOwners.length > 0) {
    warnings.push(
      `OWNER_IDS icinde gecersiz ID'ler yok sayildi: ${invalidOwners.join(', ')} (snowflake olmali)`,
    );
  }
  const validOwnerIds = ownerIds.filter((id) => SNOWFLAKE_RE.test(id));
  if (validOwnerIds.length === 0) {
    warnings.push(
      'OWNER_IDS bos: owner (!) komutlari devre disi kalir. Bot sahibi ID nizi .env dosyasina ekleyin.',
    );
  }

  // --- Emojiler ---
  // Deger uc bicimde olabilir:
  //   <:isim:ID> / <a:isim:ID> -> Discord emojisi; animasyon etiketten otomatik algilanir
  //   duz snowflake ID         -> Discord emojisi (etiketsiz)
  //   unicode metin (or. \u{1F3AE}) -> yerlesik emoji; ID gerektirmez
  const emojiMap = {};
  const missingEmojiKeys = [];
  const invalidEmojiKeys = [];
  for (const key of EMOJI_KEYS) {
    const envKey = emojiEnvKey(key);
    const raw = String(data[envKey] ?? '').trim();
    if (!raw) {
      missingEmojiKeys.push(key);
      continue;
    }
    const tag = EMOJI_TAG_RE.exec(raw);
    if (tag) {
      const animRaw = data[emojiAnimEnvKey(key)];
      let animated = raw.startsWith('<a:');
      if (animRaw === 'true') animated = true;
      if (animRaw === 'false') animated = false;
      emojiMap[key] = { id: tag[1], animated };
      continue;
    }
    if (SNOWFLAKE_RE.test(raw)) {
      const animRaw = data[emojiAnimEnvKey(key)];
      let animated = ANIMATED_BY_DEFAULT.includes(key);
      if (animRaw === 'true') animated = true;
      if (animRaw === 'false') animated = false;
      emojiMap[key] = { id: raw, animated };
      continue;
    }
    // '<' ile baslayan bozuk etiketler gecersiz; digerleri unicode (metin) emoji olabilir.
    if (!raw.startsWith('<') && UNICODE_EMOJI_RE.test(raw)) {
      emojiMap[key] = { text: raw };
      continue;
    }
    invalidEmojiKeys.push(key);
    missingEmojiKeys.push(key);
  }
  if (invalidEmojiKeys.length > 0) {
    warnings.push(
      `Gecersiz emoji degeri olan anahtarlar yok sayildi: ${invalidEmojiKeys.join(', ')} (duz ID, <:isim:id> etiketi veya unicode emoji beklenir)`,
    );
  }
  if (missingEmojiKeys.length > 0) {
    warnings.push(
      `Eksik emoji anahtarlari (${missingEmojiKeys.length} adet): ${missingEmojiKeys.join(', ')}`,
    );
  }
  if (data.EMOJI_SOURCE === 'guild') {
    if (!data.EMOJI_GUILD_ID) {
      warnings.push(
        'EMOJI_SOURCE=guild fakat EMOJI_GUILD_ID bos: sunucu emojileri cozulemez, fallback (bos string) kullanilir.',
      );
    } else if (!SNOWFLAKE_RE.test(data.EMOJI_GUILD_ID)) {
      warnings.push('EMOJI_GUILD_ID gecerli bir snowflake degil; yok sayildi.');
    }
  }

  // --- Renkler ---
  const colors = {
    primary: normalizeColor(data.COLOR_PRIMARY, '#5865F2'),
    success: normalizeColor(data.COLOR_SUCCESS, '#57F287'),
    error: normalizeColor(data.COLOR_ERROR, '#ED4245'),
    warn: normalizeColor(data.COLOR_WARN, '#FEE75C'),
    info: normalizeColor(data.COLOR_INFO, '#3B82F6'),
  };
  for (const [name, value] of Object.entries(colors)) {
    if (value === null) {
      warnings.push(`COLOR_${name.toUpperCase()} gecersiz hex; varsayilan kullanildi.`);
    }
  }
  for (const key of Object.keys(colors)) {
    if (colors[key] === null) colors[key] = { primary: '#5865F2', success: '#57F287', error: '#ED4245', warn: '#FEE75C', info: '#3B82F6' }[key];
  }

  const config = {
    nodeEnv: data.NODE_ENV,
    logLevel: data.LOG_LEVEL,
    prefix: data.DEFAULT_PREFIX,
    timezone: data.DEFAULT_TIMEZONE,
    ownerIds: validOwnerIds,
    devGuildId: data.DEV_GUILD_ID || null,
    bots,
    presenceIntent: data.ENABLE_PRESENCE_INTENT === 'true',
    mongo: { uri: data.MONGO_URI, dbName: data.MONGO_DB_NAME },
    redisUrl: data.REDIS_URL,
    healthPort: data.HEALTH_PORT,
    ownerLog: {
      guildId: data.OWNER_LOG_GUILD_ID || null,
      channelId: data.OWNER_LOG_CHANNEL_ID || null,
    },
    fivem: { cfxCode: data.FIVEM_CFX_CODE || null, ip: data.FIVEM_IP || null, whPort: data.FIVEM_WH_PORT },
    emoji: {
      source: data.EMOJI_SOURCE,
      guildId: data.EMOJI_GUILD_ID || null,
      map: emojiMap,
      missingKeys: missingEmojiKeys,
    },
    colors,
  };

  return { config, warnings };
}

/**
 * .env dosyasini yukler ve config uretir.
 * @returns {{ config: object, warnings: string[] }}
 */
export function loadEnv(opts) {
  dotenv.config({ quiet: true });
  return parseEnv(process.env, opts);
}
