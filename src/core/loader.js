/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getLogger } from './logger.js';
import { registerModule } from './moduleRegistry.js';
import { handlePrefixCommand, handleSlashCommand, OWNER_PREFIX } from './commandAdapter.js';
import { routeComponentInteraction } from '../ui/interactionRouter.js';
import { reportError } from './errorHandler.js';
import { deployCommands, splitCommandScopes } from './commandDeployer.js';
import { touchGuild } from './guildSettings.js';
import { getBlacklistEntry, isGuildBlacklisted } from './ownerGate.js';
import { auditAction } from '../owner/lib/audit.js';
import { verifyEmojis } from '../ui/emoji.js';
import { createTranslator } from '../locales/index.js';
import { error as errorTemplate } from '../ui/templates/index.js';
import { EPHEMERAL_FLAG, V2_FLAG } from '../ui/limits.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const MODULES_DIR = path.join(ROOT, 'src', 'modules');
const OWNER_COMMANDS_DIR = path.join(ROOT, 'src', 'owner', 'commands');

/** discord.js namePredicate ile ayni: kucuk harf Unicode + rakam + - _ */
const NAME_RE = /^[\p{Ll}\p{Lm}\p{Lo}\p{N}_-]{1,32}$/u;

const state = {
  loaded: false,
  modules: [],
  commands: [],
  commandIndex: new Map(),
  aliasIndex: new Map(),
  ownerCommands: [],
  ownerCommandIndex: new Map(),
  emojiVerified: false,
};

// ---------------------------------------------------------------------------
// Yardimcilar
// ---------------------------------------------------------------------------

/** Modul bot tipleri bu bot orneginde gecerli mi? */
export function matchesBotType(botTypes, type) {
  if (!Array.isArray(botTypes) || botTypes.length === 0) return true;
  if (botTypes.includes('all')) return true;
  return botTypes.includes(type);
}

/** Komut tanimini dogrular; problem listesi doner (bos = gecerli). */
function validateCommand(cmd) {
  const problems = [];
  if (!cmd || typeof cmd !== 'object') return ['komut nesnesi degil'];
  if (!cmd.name || typeof cmd.name !== 'string') problems.push('name zorunlu');
  else if (!NAME_RE.test(cmd.name)) problems.push(`gecersiz komut adi (kucuk harf/rakam/-_): ${cmd.name}`);

  const hasRun = typeof cmd.run === 'function';
  const subs = cmd.subcommands ?? [];
  if (!hasRun && subs.length === 0) problems.push('run() veya subcommands zorunlu');

  for (const sub of subs) {
    if (!sub?.name || !NAME_RE.test(sub.name)) problems.push(`gecersiz alt komut adi: ${sub?.name}`);
    if (typeof sub?.run !== 'function' && !hasRun) problems.push(`alt komutta run yok: ${sub?.name}`);
  }

  return problems;
}

async function importDefault(filePath) {
  const mod = await import(pathToFileURL(filePath).href);
  return mod.default;
}

async function scanJsDir(dirPath) {
  if (!existsSync(dirPath)) return [];
  const files = (await readdir(dirPath)).filter((f) => f.endsWith('.js')).sort();
  const items = [];
  for (const file of files) {
    items.push(await importDefault(path.join(dirPath, file)));
  }
  return items;
}

// ---------------------------------------------------------------------------
// Yukleme
// ---------------------------------------------------------------------------

async function loadModuleFromDir(dirName) {
  const dirPath = path.join(MODULES_DIR, dirName);
  const indexPath = path.join(dirPath, 'index.js');
  if (!existsSync(indexPath)) {
    getLogger().warn({ klasor: dirName }, 'Modul index.js bulunamadi; atlandi');
    return null;
  }

  const mod = await importDefault(indexPath);
  if (!mod?.id) {
    getLogger().error({ klasor: dirName }, 'Modul id yok; atlandi');
    return null;
  }

  const def = {
    botTypes: ['all'],
    defaultEnabled: true,
    ...mod,
    dir: dirPath,
  };

  def.commands = [...(mod.commands ?? []), ...(await scanJsDir(path.join(dirPath, 'commands')))];
  def.events = [...(mod.events ?? []), ...(await scanJsDir(path.join(dirPath, 'events')))];

  return def;
}

async function loadOwnerCommands() {
  const commands = await scanJsDir(OWNER_COMMANDS_DIR);
  let loaded = 0;

  for (const rawCmd of commands) {
    const problems = validateCommand(rawCmd);
    if (problems.length > 0) {
      getLogger().error(
        { komut: rawCmd?.name, problems },
        'Owner komutu dogrulamasi basarisiz; yuklenmedi',
      );
      continue;
    }
    const cmd = {
      ...rawCmd,
      ownerOnly: true,
      skipModuleCheck: true,
      module: 'owner',
      guildOnly: rawCmd.guildOnly ?? false,
      category: rawCmd.category ?? 'Genel',
    };
    // Owner komutlari AYRI isim alaninda yasar: 'yardim' hem kullanici hem owner
    // komutu olabilir; '!' onekli cagrilar yalnizca ownerCommands'a bakar.
    // Bu yuzden yalnizca OWNER komutlari arasindaki cakisma reddedilir; bir modul
    // komutuyla ayni isimde olmak serbesttir (or. '.yardım' + '!yardım').
    if (state.ownerCommandIndex.has(cmd.name)) {
      getLogger().error({ komut: cmd.name }, 'Owner komut adi cakisti; yuklenmedi');
      continue;
    }
    state.ownerCommandIndex.set(cmd.name, cmd);
    state.ownerCommands.push(cmd);
    loaded += 1;
  }

  if (loaded > 0) getLogger().info({ adet: loaded }, 'Owner komutlari yuklendi');
  return loaded;
}

/** Tum modulleri yukler (sureç basina bir kez). */
export async function initLoader() {
  if (state.loaded) return getLoaderSummary();
  const logger = getLogger();

  if (!existsSync(MODULES_DIR)) {
    throw new Error(`Modul klasoru bulunamadi: ${MODULES_DIR}`);
  }

  const dirs = (await readdir(MODULES_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, 'en'));

  for (const dirName of dirs) {
    const def = await loadModuleFromDir(dirName);
    if (!def) continue;

    let loadedCommands = 0;
    for (const rawCmd of def.commands) {
      const problems = validateCommand(rawCmd);
      if (problems.length > 0) {
        logger.error(
          { modul: def.id, komut: rawCmd?.name, problems },
          'Komut dogrulamasi basarisiz; komut yuklenmedi',
        );
        continue;
      }
      const cmd = { ...rawCmd };
      cmd.module = cmd.module ?? def.id;
      cmd.__moduleBotTypes = def.botTypes;

      if (state.commandIndex.has(cmd.name)) {
        logger.error({ modul: def.id, komut: cmd.name }, 'Komut adi cakisti; yuklenmedi');
        continue;
      }
      state.commandIndex.set(cmd.name, cmd);
      state.commands.push(cmd);
      loadedCommands += 1;

      for (const alias of cmd.aliases ?? []) {
        if (state.commandIndex.has(alias) || state.aliasIndex.has(alias)) {
          logger.warn({ alias, komut: cmd.name }, 'Kisayol adi cakisti; kisayol yok sayildi');
          continue;
        }
        state.aliasIndex.set(alias, cmd);
      }
    }

    state.modules.push(def);
    registerModule(def);
    logger.debug({ modul: def.id, komutlar: loadedCommands }, 'Modul yuklendi');
  }

  await loadOwnerCommands();
  state.loaded = true;

  logger.info(
    { moduller: state.modules.length, komutlar: state.commands.length },
    'Loader: moduller ve komutlar hazir',
  );
  return getLoaderSummary();
}

export function getLoaderSummary() {
  return {
    modules: state.modules.length,
    commands: state.commands.length,
    ownerCommands: state.ownerCommands.length,
    moduleIds: state.modules.map((m) => m.id),
  };
}

/** Yetki dugumu (permission.node) tanimli komutlar. */
export function listCommandNodes() {
  const nodes = new Map();
  for (const cmd of state.commands) {
    const node = cmd.permission?.node;
    if (!node) continue;
    if (!nodes.has(node)) nodes.set(node, []);
    nodes.get(node).push(cmd.name);
  }
  return [...nodes.entries()].map(([node, commands]) => ({ node, commands }));
}

// ---------------------------------------------------------------------------
// Bot ornegi baglama
// ---------------------------------------------------------------------------

/** Bot tipine gore komut/kisayol dizini uretir. Owner komutlari ayri tutulur. */
export function buildInstanceRegistry(type) {
  const commands = new Map();
  const aliases = new Map();
  const commandList = [];

  for (const cmd of state.commands) {
    const types = cmd.botTypes ?? cmd.__moduleBotTypes;
    if (!matchesBotType(types, type)) continue;

    commands.set(cmd.name, cmd);
    commandList.push(cmd);
    for (const alias of cmd.aliases ?? []) {
      if (!aliases.has(alias)) aliases.set(alias, cmd);
    }
  }

  const ownerCommands = new Map();
  const ownerAliases = new Map();

  for (const cmd of state.ownerCommands) {
    ownerCommands.set(cmd.name, cmd);
    for (const alias of cmd.aliases ?? []) {
      if (!ownerAliases.has(alias)) ownerAliases.set(alias, cmd);
    }
  }

  // Slash kapsamlari (100 global + 100 guild): kapsam disinda kalan komutlar
  // yalnizca prefix (!) ile calisir; yardim/arama notlarinda kullanilir.
  const scopes = splitCommandScopes(commandList);
  const prefixOnly = new Set(scopes.prefixOnly.map((c) => c.name));

  return {
    type,
    commands,
    aliases,
    commandList,
    prefixOnly,
    ownerCommands,
    ownerAliases,
    ownerList: [...state.ownerCommands],
  };
}

const EXPIRED_REPLY_DELAY_MS = 1500;

/** Sahipsiz buton/select tiklamalarina (collector yanitlamadiysa) nazik cevap. */
function scheduleExpiredReply(interaction) {
  setTimeout(async () => {
    if (interaction.replied || interaction.deferred) return; // collector/yetkili yanitladi
    try {
      const t = createTranslator('tr');
      const card = errorTemplate(t('errors.select_timeout.title'), [t('errors.select_timeout.body')]);
      await interaction.reply({
        ...card,
        flags: (card.flags ?? V2_FLAG) | EPHEMERAL_FLAG,
      });
    } catch {
      /* yut */
    }
  }, EXPIRED_REPLY_DELAY_MS).unref?.();
}

async function handleInteraction(interaction, ctx) {
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(interaction, ctx);
    return;
  }

  const isComponent = interaction.isMessageComponent?.() || interaction.isModalSubmit?.();
  if (!isComponent) return;

  const handled = await routeComponentInteraction(interaction);
  if (handled) return;

  const isClickable =
    interaction.isButton?.() || (interaction.isAnySelectMenu ? interaction.isAnySelectMenu() : false);
  if (isClickable) scheduleExpiredReply(interaction);
}

/**
 * Sunucuya eklendi: kara listedeyse sahibine haber verip ayrilir,
 * aksi halde guild kaydini olusturur/tazeler.
 */
async function handleGuildJoin(guild, { config }) {
  if (await isGuildBlacklisted(guild.id)) {
    const entry = await getBlacklistEntry(guild.id);
    const t = createTranslator('tr');

    if (entry?.notify !== false) {
      try {
        const owner = await guild.fetchOwner();
        const card = errorTemplate(t('owner.blacklist_dm_title'), [
          t('owner.blacklist_dm_body', { sunucu: guild.name }),
        ]);
        await owner.send(card);
      } catch {
        /* DM kapali */
      }
    }

    await guild.leave().catch(() => {});
    await auditAction({
      config,
      ownerId: 'system',
      action: 'kara-liste-otomatik-ayril',
      target: guild.id,
      guildId: guild.id,
      payload: { isim: guild.name, notify: entry?.notify !== false },
      t,
    });
    return;
  }

  await touchGuild(guild);
}

async function onInstanceReady(instance, { config, registry }) {
  const client = instance.client;
  const logger = getLogger();

  // 1) Emoji dogrulama (sureç basina bir kez; hata olsa da devam)
  if (!state.emojiVerified) {
    state.emojiVerified = true;
    verifyEmojis(client).catch(() => {});
  }

  // 2) Slash komut dagitimi (global + varsa dev sunucusu)
  try {
    await deployCommands(client, registry.commandList, { devGuildId: config.devGuildId });
  } catch (err) {
    await reportError(err, { source: 'komut_dagitimi' });
  }

  // 3) Modul setup cagrilari (paneller, zamanlayicilar...)
  for (const def of state.modules) {
    if (!matchesBotType(def.botTypes, instance.type)) continue;
    if (typeof def.setup !== 'function') continue;
    try {
      await def.setup(client, { config, registry, logger });
    } catch (err) {
      await reportError(err, { source: `modul_setup:${def.id}` });
    }
  }

  // 4) Sunucu kayitlarini arka planda tazele (bloklamaz)
  setTimeout(() => {
    const guilds = [...client.guilds.cache.values()];
    Promise.allSettled(guilds.map((g) => touchGuild(g))).catch(() => {});
  }, 2000).unref?.();
}

/**
 * Loader'i bir bot ornegine baglar: event'ler, prefix/slash yonlendirme, ready isleri.
 * @param {import('./BotInstance.js').BotInstance} instance
 * @param {{ config: object }} opts
 */
export async function attachInstance(instance, { config }) {
  const client = instance.client;
  const registry = buildInstanceRegistry(instance.type);
  instance.registry = registry;
  instance.__loaderListeners = [];
  client.registry = registry;

  // Modul event'leri
  for (const def of state.modules) {
    if (!matchesBotType(def.botTypes, instance.type)) continue;
    for (const event of def.events ?? []) {
      if (!event?.name || typeof event.execute !== 'function') continue;
      const handler = (...args) => {
        Promise.resolve()
          .then(() => event.execute(...args, { client, config, registry, module: def }))
          .catch((err) =>
            reportError(err, {
              source: `event:${event.name}`,
              extra: { module: def.id },
            }),
          );
      };
      if (event.once) client.once(event.name, handler);
      else client.on(event.name, handler);
      instance.__loaderListeners.push({ name: event.name, handler, once: Boolean(event.once) });
    }
  }

  // Prefix komutlari (! owner oneki dahil; DM yalnizca '!' icin serbest birakilir)
  const onMessage = (message) => {
    if (!message.content || message.author?.bot) return;
    if (!message.guild && !message.content.startsWith(OWNER_PREFIX)) return;
    handlePrefixCommand(message, { config, registry }).catch((err) =>
      reportError(err, {
        source: 'prefix',
        guildId: message.guildId,
        userId: message.author?.id,
      }),
    );
  };
  client.on('messageCreate', onMessage);
  instance.__loaderListeners.push({ name: 'messageCreate', handler: onMessage });

  // Slash + bilesen etkilesimleri
  const onInteraction = (interaction) => {
    handleInteraction(interaction, { config, registry }).catch((err) =>
      reportError(err, {
        source: 'interaction',
        guildId: interaction.guildId,
        userId: interaction.user?.id,
      }),
    );
  };
  client.on('interactionCreate', onInteraction);
  instance.__loaderListeners.push({ name: 'interactionCreate', handler: onInteraction });

  // Sunucuya eklendiginde: kara listedeyse otomatik ayril; degilse kayit olustur
  const onGuildCreate = (guild) => {
    handleGuildJoin(guild, { config }).catch((err) =>
      reportError(err, { source: 'guildCreate', guildId: guild.id }),
    );
  };
  client.on('guildCreate', onGuildCreate);
  instance.__loaderListeners.push({ name: 'guildCreate', handler: onGuildCreate });

  // Ready: dagitim + setup
  const onReady = () => {
    onInstanceReady(instance, { config, registry }).catch((err) =>
      reportError(err, { source: 'ready', extra: { bot: instance.type } }),
    );
  };
  client.once('ready', onReady);
  instance.__loaderListeners.push({ name: 'ready', handler: onReady, once: true });

  instance.logger.info(
    { komutlar: registry.commandList.length, moduller: state.modules.length },
    'Loader bot ornegine baglandi',
  );

  return registry;
}

/** Zarif kapanista modul teardown cagrilari. */
export async function teardownInstance(instance) {
  const client = instance.client;
  for (const def of state.modules) {
    if (!matchesBotType(def.botTypes, instance.type)) continue;
    if (typeof def.teardown !== 'function') continue;
    try {
      await def.teardown(client);
    } catch (err) {
      await reportError(err, { source: `modul_teardown:${def.id}` });
    }
  }
}
