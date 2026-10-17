/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { getLogger } from './logger.js';

/**
 * Tek bot ornegi: bir token + bir bot tipi (fivem | public | guard | ticket | yetkikontrol).
 *
 * istemci olusturma, intent yonetimi, giris/cikis ve temel olay loglari.
 * +: loader (modul/komut/event), commandAdapter, modul seti bu sinifa baglanacak.
 */

const REQUIRED_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.GuildEmojisAndStickers,
  GatewayIntentBits.GuildInvites,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.GuildWebhooks,
  GatewayIntentBits.GuildIntegrations,
];

/**
 * presence yalnizca mesai "oyunda mi" / durum-kontrol icin gerekir;
 * ayarla kapatilabilir (GuildPresences privileged ve agir bir intenttir).
 */
export function buildIntents({ presenceIntent }) {
  const intents = [...REQUIRED_INTENTS];
  if (presenceIntent) {
    intents.push(GatewayIntentBits.GuildPresences);
  }
  return intents;
}

export const REQUIRED_PARTIALS = [
  Partials.Message,
  Partials.Channel,
  Partials.Reaction,
  Partials.GuildMember,
  Partials.User,
];

export class BotInstance {
  /**
   * @param {{ type: string, label: string, token: string, config: object }} opts
   */
  constructor({ type, label, token, config }) {
    this.type = type;
    this.label = label;
    this.token = token;
    this.config = config;
    this.logger = getLogger().child({ bot: `${type}-${label}` });

    this.client = new Client({
      intents: buildIntents(config),
      partials: REQUIRED_PARTIALS,
      // / 17.4: varsayilan olarak hicbir mention islenmez
      allowedMentions: { parse: [] },
    });

    this.#bindCoreEvents();
  }

  get tag() {
    return this.client.user ? this.client.user.tag : `${this.type}-${this.label} (giris yapilmadi)`;
  }

  isReady() {
    return this.client.isReady();
  }

  #bindCoreEvents() {
    const logger = this.logger;

    this.client.once('ready', (client) => {
      logger.info(
        { tag: client.user.tag, guilds: client.guilds.cache.size },
        'Bot hazir (ready)',
      );
    });

    this.client.on('error', (err) => {
      logger.error({ err: err.message }, 'Discord istemci hatasi');
    });

    this.client.on('warn', (message) => {
      logger.warn({ message }, 'Discord uyarisi');
    });

    this.client.on('shardError', (err, shardId) => {
      logger.error({ err: err.message, shardId }, 'Shard baglanti hatasi');
    });

    this.client.on('shardDisconnect', (event, shardId) => {
      logger.warn({ code: event.code, shardId }, 'Shard baglantisi koptu');
    });

    this.client.on('shardReconnecting', (shardId) => {
      logger.warn({ shardId }, 'Shard yeniden baglaniyor');
    });
  }

  async start() {
    this.logger.info('Bot baslatiliyor...');
    await this.client.login(this.token);
    return this;
  }

  async stop() {
    try {
      await this.client.destroy();
      this.logger.info('Bot durduruldu.');
    } catch (err) {
      this.logger.warn({ err: err.message }, 'Bot durdurulurken hata (yok sayildi)');
    }
  }
}
