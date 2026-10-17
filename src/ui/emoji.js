/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getLogger } from '../core/logger.js';

let state = {
  source: 'guild',
  guildId: null,
  map: {},
  missingKeys: [],
  verify: null, // { ok, checkedAt, missingInDiscord: [], extraInDiscord: 0 }
};

const warnedKeys = new Set();

export function initEmoji(emojiConfig) {
  state = {
    source: emojiConfig.source ?? 'guild',
    guildId: emojiConfig.guildId ?? null,
    map: emojiConfig.map ?? {},
    missingKeys: emojiConfig.missingKeys ?? [],
    verify: null,
  };
  warnedKeys.clear();
  return state;
}

function warnMissing(key) {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  getLogger().warn(
    { key },
    `Emoji anahtari eksik veya gecersiz (EMOJI_${String(key).toUpperCase()}); bos string kullanildi.`,
  );
}

/** '<:isim:id>' / '<a:isim:id>' cozumler; anahtar yoksa ''. */
export function emoji(key) {
  const entry = state.map[key];
  if (!entry) {
    warnMissing(key);
    return '';
  }
  if (entry.text) return entry.text;
  const name = String(key).toLowerCase();
  return entry.animated ? `<a:${name}:${entry.id}>` : `<:${name}:${entry.id}>`;
}

/** Ham emoji tag'ini (metin) destekleyen kullanimlar icin ayni cagri. */
export function emojiTag(key) {
  return emoji(key);
}

/** Button / Select icin emoji nesnesi; anahtar yoksa undefined (hata vermez). */
export function emojiObj(key) {
  const entry = state.map[key];
  if (!entry) {
    warnMissing(key);
    return undefined;
  }
  if (entry.text) return { name: entry.text };
  return { id: entry.id, name: String(key).toLowerCase(), animated: Boolean(entry.animated) };
}

/** Bazi yerlerde 'anahtar yoksa alternatif goster' davranisi icin. */
export function emojiOr(key, fallback = '') {
  return state.map[key] ? emoji(key) : fallback;
}

/** /emoji-kontrol raporu icin ham durum. */
export function emojiReport() {
  return {
    source: state.source,
    guildId: state.guildId,
    total: Object.keys(state.map).length + state.missingKeys.length,
    filled: Object.keys(state.map).length,
    missingKeys: [...state.missingKeys],
    verify: state.verify,
  };
}

/**
 * Botun erisebildigi emoji kaynagiyla .env ID'lerini karsilastirir (silinmis/yetkisiz ID tespiti).
 * Basarisizlik botu durdurmaz; rapor /emoji-kontrol komutunda gosterilir.
 * @param {import('discord.js').Client} client
 */
export async function verifyEmojis(client) {
  const logger = getLogger();
  const result = { ok: false, checkedAt: new Date().toISOString(), missingInDiscord: [], invalidJson: [] };

  try {
    let availableIds = new Set();

    if (state.source === 'application') {
      const emojis = await client.application?.emojis.fetch();
      availableIds = new Set(emojis ? [...emojis.keys()] : []);
    } else if (state.guildId) {
      const guild = client.guilds.cache.get(state.guildId) ?? (await client.guilds.fetch(state.guildId));
      const emojis = await guild.emojis.fetch();
      availableIds = new Set(emojis.map((e) => e.id));
    }

    if (availableIds.size === 0) {
      result.ok = false;
      result.note = 'Emoji kaynagi bos veya erisilemedi (EMOJI_SOURCE=application|guild, EMOJI_GUILD_ID kontrol edin).';
      state.verify = result;
      return result;
    }

    for (const [key, entry] of Object.entries(state.map)) {
      if (entry.text) continue; // yerlesik (unicode) emoji: Discord kaynaginda aranmaz
      if (!availableIds.has(entry.id)) {
        result.missingInDiscord.push({ key, id: entry.id });
      }
    }

    result.ok = result.missingInDiscord.length === 0;
    state.verify = result;
    if (!result.ok) {
      logger.warn(
        { adet: result.missingInDiscord.length },
        'Bazi emoji ID leri Discord kaynaginda bulunamadi (/emoji-kontrol ile listeleyin).',
      );
    }
    return result;
  } catch (err) {
    result.ok = false;
    result.note = `Dogrulama hatasi: ${err?.message ?? err}`;
    state.verify = result;
    logger.warn({ err: err?.message }, 'Emoji dogrulamasi yapilamadi (bot calismaya devam eder).');
    return result;
  }
}
