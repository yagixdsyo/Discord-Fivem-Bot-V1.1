/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { createHash } from 'node:crypto';
import { buildSlashCommand } from './slashBuilder.js';
import { getLogger } from './logger.js';
import { getRedis, isRedisReady } from './redis.js';
import { reportError } from './errorHandler.js';

/** Discord: uygulama basina global CHAT_INPUT limiti. */
export const GLOBAL_LIMIT = 100;
/** Discord: sunucu basina guild CHAT_INPUT limiti. */
export const GUILD_LIMIT = 100;

/**
 * Global kapsama oncelikli modul sirasi (once yuksek kullanimli yonetim modulleri).
 * Listede olmayan moduller en sona atilir (ad sirasina gore).
 */
export const MODULE_PRIORITY = [
  'core',
  'moderation',
  'guard',
  'fivem',
  'shift',
  'team',
  // terfi (yetkili) ve oda komutlari slash kapsamina alindi.
  'terfi',
  'ticket',
  'setup',
  'rooms',
  'logging',
  'application',
  'yetkikontrol',
  'blacklist',
  'karar',
  'sicil',
  'backup',
  'gorev',
  'izin',
  'analitik',
  'duyuru',
  'announce',
  'event',
  'ani',
  'ai',
  'fun',
];

function commandPriority(cmd) {
  const index = MODULE_PRIORITY.indexOf(cmd?.module);
  return index === -1 ? MODULE_PRIORITY.length : index;
}

/**
 * Komutlari kapsamlara boler (saf fonksiyon - test edilebilir).
 * Owner komutlari ve ownerOnly isaretliler haric tutulur.
 *
 * @param {object[]} commands
 * @returns {{global: object[], guild: object[], prefixOnly: object[], total: number}}
 */
export function splitCommandScopes(commands) {
  const active = (commands ?? []).filter((c) => c && !c.ownerOnly);
  const sorted = [...active].sort((a, b) => {
    const pa = commandPriority(a);
    const pb = commandPriority(b);
    if (pa !== pb) return pa - pb;
    return String(a.name).localeCompare(String(b.name), 'tr');
  });
  return {
    global: sorted.slice(0, GLOBAL_LIMIT),
    guild: sorted.slice(GLOBAL_LIMIT, GLOBAL_LIMIT + GUILD_LIMIT),
    prefixOnly: sorted.slice(GLOBAL_LIMIT + GUILD_LIMIT),
    total: sorted.length,
  };
}

function hashBody(body, scope) {
  return createHash('sha256').update(`${scope}:${JSON.stringify(body)}`).digest('hex');
}

/**
 * @param {import('discord.js').Client} client
 * @param {object[]} commands (ownerOnly olmayan) komut tanimlari
 * @param {{ devGuildId?: string|null, force?: boolean }} [opts]
 */
export async function deployCommands(client, commands, { devGuildId = null, force = false } = {}) {
  const logger = getLogger();
  const { global: globalList, guild: guildList, prefixOnly, total } = splitCommandScopes(commands);
  if (total === 0) return { global: 0, guild: 0, prefixOnly: 0, changed: false };

  const appId = client.application?.id ?? 'bilinmiyor';
  const globalBody = globalList.map((c) => buildSlashCommand(c).toJSON());
  const globalHash = hashBody(globalBody, 'global');
  const globalKey = `deploy:hash:global:${appId}`;

  let changed = force;
  if (!changed) {
    if (isRedisReady()) {
      const prev = await getRedis().get(globalKey);
      changed = prev !== globalHash;
    } else {
      changed = true;
    }
  }

  let globalCount = 0;
  if (changed) {
    try {
      const result = await client.application.commands.set(globalBody);
      globalCount = result.size;
      if (isRedisReady()) await getRedis().set(globalKey, globalHash);
      logger.info({ adet: globalCount }, 'Global slash komutlari kaydedildi');
    } catch (err) {
      await reportError(err, { source: 'komut_dagitimi', extra: { hedef: 'global' } });
    }
  } else {
    logger.debug('Slash komut seti degismedi; global kayit atlandi');
  }

  // ---------------------------------------------------------------------------
  // Guild kapsami: global limiti asan komutlar botun bulundugu her sunucuya yazilir.
  // ---------------------------------------------------------------------------
  let guildCount = 0;
  let guildApplied = 0;
  const guildBody = guildList.map((c) => buildSlashCommand(c).toJSON());
  if (guildBody.length > 0) {
    const guildHash = hashBody(guildBody, 'guild');
    const guildKey = `deploy:hash:guild:${appId}`;
    let guildChanged = force;
    if (!guildChanged) {
      if (isRedisReady()) {
        const prev = await getRedis().get(guildKey);
        guildChanged = prev !== guildHash;
      } else {
        guildChanged = true;
      }
    }

    if (guildChanged) {
      for (const guild of client.guilds.cache.values()) {
        try {
          const result = await guild.commands.set(guildBody);
          guildCount = Math.max(guildCount, result.size);
          guildApplied += 1;
        } catch (err) {
          logger.warn(
            { err: err?.message, guildId: guild.id },
            'Guild kapsami komut kaydi basarisiz (global kayit etkilenmedi)',
          );
        }
      }
      // Gelistirme sunucusu onbellekte yoksa da guild kapsamini alir (hizli test).
      if (devGuildId && !client.guilds.cache.has(devGuildId)) {
        const dev = await client.guilds.fetch(devGuildId).catch(() => null);
        if (dev) {
          try {
            const result = await dev.commands.set(guildBody);
            guildCount = Math.max(guildCount, result.size);
            guildApplied += 1;
          } catch (err) {
            logger.warn({ err: err?.message, devGuildId }, 'DEV_GUILD_ID komut kaydi basarisiz');
          }
        }
      }
      if (isRedisReady()) await getRedis().set(guildKey, guildHash);
      logger.info(
        { adet: guildCount, sunucu: guildApplied },
        'Guild kapsami slash komutlari kaydedildi',
      );
    } else {
      logger.debug('Guild kapsami komut seti degismedi; kayit atlandi');
    }
  }

  // ---------------------------------------------------------------------------
  // 200'u asan komutlar: yalnizca prefix (!) ile kullanilir.
  // ---------------------------------------------------------------------------
  if (prefixOnly.length > 0) {
    logger.warn(
      {
        adet: prefixOnly.length,
        ornekler: prefixOnly.slice(0, 12).map((c) => c.name),
      },
      'Slash limiti (100 global + 100 guild) asildi; bu komutlar yalnizca prefix ile calisir ve /komut-ara ile bulunur',
    );
  }

  return { global: globalCount, guild: guildCount, prefixOnly: prefixOnly.length, changed };
}
