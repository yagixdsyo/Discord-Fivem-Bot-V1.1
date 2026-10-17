/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { MessageFlags } from 'discord.js';
import { getLogger } from './logger.js';
import { reportError } from './errorHandler.js';
import { abuseMuteRemaining, checkCooldown, clearAbuse, markAbuse } from './cooldown.js';
import { GATE_CODES, checkOwnerGate } from './ownerGate.js';
import { getModule } from './moduleRegistry.js';
import { commandGateLabel, isCommandActive } from './systemRegistry.js';
import { canRun } from './permissions.js';
import { getGuildConfig, touchGuild } from './guildSettings.js';
import { isOwnerUser } from './ownerRegistry.js';
import { recordCommandUsage } from './usageStats.js';
import { maybeAutoNotify } from './announcements.js';
import { argsFromInteraction, parseArgs, tokenize } from './argParser.js';
import { createTranslator } from '../locales/index.js';
import { EPHEMERAL_FLAG, V2_FLAG, validateV2Payload } from '../ui/limits.js';
import { emoji as emojiResolve } from '../ui/emoji.js';
import { getColors } from '../ui/colors.js';
import { usage as usageTemplate } from '../ui/templates/index.js';
import { error as errorTemplate, warn as warnTemplate } from '../ui/templates/index.js';
import { getCollection, isDbReady } from '../db/index.js';

const AUTO_DEFER_MS = 2000;
const PREFIX_EPHEMERAL_DELETE_MS = 10_000;
const DEFAULT_COOLDOWN = 3;

/** Owner komut oneki. Owner komutlari slash'e ASLA kaydedilmez. */
export const OWNER_PREFIX = '!';

// ---------------------------------------------------------------------------
// Payload yardimcilari
// ---------------------------------------------------------------------------

/** Sablon payload'ina V2 bayragi garantile (ve gerekirse Ephemeral ekle). */
function ensureFlags(payloadIn, { ephemeral = false } = {}) {
  if (!payloadIn) return payloadIn;
  const result = { ...payloadIn };
  result.flags = (result.flags ?? 0) | V2_FLAG;
  if (ephemeral) result.flags |= EPHEMERAL_FLAG;
  if (!result.allowedMentions) result.allowedMentions = { parse: [] };

  const check = validateV2Payload(result, { requireV2Flag: false });
  if (!check.ok) {
    getLogger().error({ errors: check.errors }, '[V2] Gecersiz payload gonderilmek uzere (gelistirici hatasi)');
  }
  return result;
}

function toEphemeral(payloadIn) {
  return ensureFlags({ ...payloadIn, flags: payloadIn.flags ?? V2_FLAG }, { ephemeral: true });
}

// ---------------------------------------------------------------------------
// Basit tepki kartlari (ctx olmadan erken asamada gerekli olanlar)
// ---------------------------------------------------------------------------

function gateCard(t, gate) {
  switch (gate.code) {
    case GATE_CODES.DEACTIVATED:
      return errorTemplate(t('errors.guild_deactivated.title'), [t('errors.guild_deactivated.body')]);
    case GATE_CODES.GLOBAL_PAUSED:
      return warnTemplate(t('errors.bot_paused.title'), [t('errors.bot_paused.body')]);
    case GATE_CODES.GLOBAL_MAINTENANCE:
      return warnTemplate(t('errors.maintenance_global.title'), [
        t('errors.maintenance_global.body', { bitis: formatUntil(gate.until) }),
      ]);
    case GATE_CODES.COMMAND_DISABLED:
      return errorTemplate(t('errors.command_disabled.title'), [
        t('errors.command_disabled.body', { komut: gate.detail ?? '' }),
      ]);
    case GATE_CODES.COMMAND_MAINTENANCE:
      return warnTemplate(t('errors.command_maintenance.title'), [
        t('errors.command_maintenance.body', { komut: gate.detail ?? '', bitis: formatUntil(gate.until) }),
      ]);
    case GATE_CODES.MODULE_MAINTENANCE: {
      const def = getModule(gate.detail);
      return warnTemplate(t('errors.command_maintenance.title'), [
        t('errors.command_maintenance.body', { komut: def?.name ?? gate.detail ?? '', bitis: formatUntil(gate.until) }),
      ]);
    }
    default:
      return errorTemplate(t('errors.unexpected.title'), [t('errors.unexpected.body')]);
  }
}

function formatUntil(until) {
  if (!until) return '-';
  const ts = Math.floor(Number(until) / 1000);
  if (!Number.isFinite(ts)) return '-';
  return `<t:${ts}:F> (<t:${ts}:R>)`;
}

// ---------------------------------------------------------------------------
// Baglam (ctx) - iki kaynak icin ayni
// ---------------------------------------------------------------------------

function createContext({ source, interaction, message, command, args, guildConfig, config, prefix, registry }) {
  const guild = interaction?.guild ?? message?.guild ?? null;
  const user = interaction?.user ?? message?.author;
  const member = interaction?.member ?? message?.member ?? null;
  const channel = interaction?.channel ?? message?.channel ?? null;
  const client = interaction?.client ?? message?.client ?? null;
  const t = createTranslator(guildConfig?.language ?? 'tr');

  const state = {
    replied: false,
    deferred: false,
    lastMessage: null,
    autoDeferTimer: null,
    interaction,
  };

  function normalize(payloadIn, { ephemeral = false } = {}) {
    return ensureFlags(payloadIn, { ephemeral });
  }

  function stopAutoDefer() {
    if (state.autoDeferTimer) {
      clearTimeout(state.autoDeferTimer);
      state.autoDeferTimer = null;
    }
  }

  async function reply(payloadIn, opts = {}) {
    stopAutoDefer();
    const normalized = normalize(payloadIn, { ephemeral: Boolean(opts.ephemeral) });

    if (source === 'slash') {
      if (state.deferred) {
        state.replied = true;
        return interaction.editReply(normalized);
      }
      if (state.replied) {
        return interaction.followUp(normalized);
      }
      state.replied = true;
      if (opts.fetchReply) {
        const sent = await interaction.reply({ ...normalized, fetchReply: true });
        state.lastMessage = sent;
        return sent;
      }
      await interaction.reply(normalized);
      return null;
    }

    // Prefix
    if (opts.ephemeral) {
      // Hassas cevap: once DM dene
      try {
        const dm = await user.send(normalized);
        state.lastMessage = dm;
        return dm;
      } catch {
        const sent = await channel.send(normalized);
        state.lastMessage = sent;
        setTimeout(() => {
          sent.delete().catch(() => {});
        }, PREFIX_EPHEMERAL_DELETE_MS);
        return sent;
      }
    }

    const sent = await message.reply(normalized);
    state.lastMessage = sent;
    return sent;
  }

  async function defer({ ephemeral = false } = {}) {
    if (source !== 'slash') return;
    if (state.deferred || state.replied) return;
    stopAutoDefer();
    state.deferred = true;
    await interaction.deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : 0 });
  }

  async function edit(payloadIn, opts = {}) {
    const normalized = normalize(payloadIn, { ephemeral: Boolean(opts.ephemeral) });
    if (source === 'slash') {
      if (state.deferred || state.replied) return interaction.editReply(normalized);
      state.replied = true;
      return interaction.reply(normalized);
    }
    if (state.lastMessage) return state.lastMessage.edit(normalized);
    return reply(payloadIn, opts);
  }

  async function followUp(payloadIn, opts = {}) {
    const normalized = normalize(payloadIn, { ephemeral: Boolean(opts.ephemeral) });
    if (source === 'slash') {
      // Etkilesim hic yanitlanmadiysa followUp Discord tarafindan reddedilir
      // (InteractionNotReplied); bu durumda ilk yaniti reply olarak gonder.
      const acknowledged = state.replied || state.deferred || interaction.replied || interaction.deferred;
      if (!acknowledged) {
        state.replied = true;
        if (opts.fetchReply) {
          const sent = await interaction.reply({ ...normalized, fetchReply: true });
          state.lastMessage = sent;
          return sent;
        }
        await interaction.reply(normalized);
        return null;
      }
      return interaction.followUp(normalized);
    }
    return channel.send(normalized);
  }

  const ctx = {
    source,
    command,
    args,
    guild,
    user,
    member,
    channel,
    client,
    interaction,
    message,
    config,
    registry,
    guildConfig,
    prefix,
    t,
    emoji: emojiResolve,
    colors: getColors(),
    db: {
      get ready() {
        return isDbReady();
      },
      collection: (name) => getCollection(name),
    },
    reply,
    defer,
    edit,
    followUp,
    get replied() {
      return state.replied;
    },
    get deferred() {
      return state.deferred;
    },
    _state: state,
    _stopAutoDefer: stopAutoDefer,
    _startAutoDefer() {
      if (source !== 'slash' || !interaction) return;
      state.autoDeferTimer = setTimeout(() => {
        if (!state.replied && !state.deferred && !interaction.deferred && !interaction.replied) {
          interaction.deferReply().catch(() => {});
          state.deferred = true;
        }
      }, AUTO_DEFER_MS);
    },
  };

  return ctx;
}

// ---------------------------------------------------------------------------
// Ortak komut calistirici
// ---------------------------------------------------------------------------

function activeDefinition(command, subName) {
  if (!subName) return { args: command.args ?? [], run: command.run, sub: null };
  const sub = (command.subcommands ?? []).find((s) => s.name === subName);
  if (!sub) return null;
  return { args: sub.args ?? [], run: sub.run ?? command.run, sub };
}

/** run cagrisini hata korumali sekilde yapar; hata olursa kullaniciya kodlu kart doner. */
async function executeRun(ctx, run, { source }) {
  ctx._startAutoDefer();
  try {
    await run(ctx);
    return true;
  } catch (err) {
    ctx._stopAutoDefer();
    const guildId = ctx.guild?.id ?? null;
    const entry = await reportError(err, {
      source: `${source}_komut`,
      guildId,
      userId: ctx.user?.id ?? null,
      command: ctx.command?.name ?? null,
    });

    const card = errorTemplate(ctx.t('errors.unexpected.title'), [ctx.t('errors.unexpected.body')], {
      codeLine: ctx.t('common.error_code_line', { kod: entry.code }),
    });

    try {
      if (source === 'slash') {
        if (ctx._state.deferred || ctx._state.replied) {
          await ctx.followUp(card, { ephemeral: true });
        } else {
          await ctx.reply(card, { ephemeral: true });
        }
      } else if (!ctx._state.lastMessage) {
        await ctx.reply(card);
      } else {
        await ctx.followUp(card);
      }
    } catch (replyErr) {
      getLogger().error({ err: replyErr?.message }, 'Hata karti gonderilemedi');
    }
    return false;
  }
}

/** Komut sonrasi ortak kayit: kullanim istatistigi + guncelleme bildirimi. */
function afterCommand(ctx, command, ok) {
  if (command.ownerOnly) return;
  recordCommandUsage({ guildId: ctx.guild?.id ?? null, command: command.name, ok });
  if (ok) maybeAutoNotify(ctx).catch(() => {});
  // Komut kullanim logu kanali; dongu olusturmasin
  // diye dinamik import + yutma.
  if (ok && ctx.guild && command.module !== 'logging') {
    import('../modules/logging/lib/usage.js')
      .then((mod) => mod.logCommandUsage(ctx, command))
      .catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Slash
// ---------------------------------------------------------------------------

export async function handleSlashCommand(interaction, { config, registry }) {
  const command = registry.commands.get(interaction.commandName);
  if (!command) {
    // Bu bot icin tanimsiz (baska botun komutu olabilir): sessizce gec
    return;
  }

  const subName = interaction.options.getSubcommand(false) ?? null;
  const active = activeDefinition(command, subName);
  const guildConfig = interaction.guild ? await getGuildConfig(interaction.guild.id) : null;
  const t = createTranslator(guildConfig?.language ?? 'tr');
  const isOwner = await isOwnerUser(config, interaction.user.id);

  if (!active) {
    await interaction.reply(toEphemeral(errorTemplate(t('errors.unexpected.title'), [t('errors.unexpected.body')])));
    return;
  }
  if (!active.run) {
    await interaction.reply(toEphemeral(usageWithErrors(t, command, '/', [])));
    return;
  }

  // Zorunlu: sunucu disi komut kontrolu
  const guildOnly = command.guildOnly !== false;
  if (guildOnly && !interaction.guild) {
    await interaction.reply(
      toEphemeral(errorTemplate(t('errors.guild_only.title'), [t('errors.guild_only.body')])),
    );
    return;
  }

  // 1) Owner kapi
  const gate = await checkOwnerGate({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    commandName: command.name,
    moduleId: command.module,
    isOwner,
  });
  if (gate) {
    // Kara liste: HICBIR SEY yapma - sessiz.
    if (gate.code === GATE_CODES.BLACKLISTED) return;
    await interaction.reply(toEphemeral(gateCard(t, gate)));
    return;
  }

  // 2) Modul + sistem katmani (owner komutlari muaf)
  const moduleActive = command.skipModuleCheck
    ? true
    : await isCommandActive({ guildId: interaction.guildId, command });
  if (!moduleActive) {
    await interaction.reply(
      toEphemeral(
        warnTemplate(t('errors.module_disabled.title'), [
          t('errors.module_disabled.body', { modul: commandGateLabel(command) }),
        ]),
      ),
    );
    return;
  }

  // 3) Kullanici katmani
  const perm = await canRun({
    command,
    member: interaction.member,
    guild: interaction.guild,
    isOwner,
  });
  if (!perm.ok) {
    if (perm.reason === 'owner_only') return; // owner komutlari slash'te sessiz
    await interaction.reply(toEphemeral(permissionCard(t, command, perm)));
    return;
  }

  // 4) Cooldown
  const cooldown = command.cooldown ?? DEFAULT_COOLDOWN;
  const cd = await checkCooldown({
    userId: interaction.user.id,
    guildId: interaction.guildId,
    command: command.name,
    seconds: cooldown,
    guildSeconds: command.cooldownGuild,
  });
  if (cd.limited) {
    await interaction.reply(
      toEphemeral(
        warnTemplate(t('errors.cooldown.title'), [
          t('errors.cooldown.body', { saniye: Math.ceil((cd.retryAfterMs ?? 0) / 1000) }),
        ]),
      ),
    );
    return;
  }

  // 5) Argumanlar (slash tarafi)
  const parsed = argsFromInteraction(interaction, active.args);
  if (!parsed.ok) {
    await interaction.reply(toEphemeral(usageWithErrors(t, command, guildConfig?.prefix ?? config.prefix, parsed.errors)));
    return;
  }

  // ctx ve calistirma
  const ctx = createContext({
    source: 'slash',
    interaction,
    command,
    args: parsed.args,
    guildConfig,
    config,
    prefix: '/',
    registry,
  });

  const ok = await executeRun(ctx, active.run, { source: 'slash' });
  afterCommand(ctx, command, ok);
  await clearAbuse({ guildId: interaction.guildId, userId: interaction.user.id });
}

// ---------------------------------------------------------------------------
// Prefix
// ---------------------------------------------------------------------------

export async function handlePrefixCommand(message, { config, registry }) {
  const guildConfig = message.guild ? await getGuildConfig(message.guild.id) : null;
  const prefix = guildConfig?.prefix ?? config.prefix;

  const userId = message.author.id;

  // Owner komutlari '!' onekiyle; sahip olmayanlara SESSIZ.
  // Ayri isim alani: '!yardım' (owner) ile '.yardım' (kullanici) cakismaz.
  // isOwnerUser yalnizca '!' ile baslayan mesajlarda Redis'e gider (performans).
  const ownerCandidate = message.content.startsWith(OWNER_PREFIX);
  let isOwner = config.ownerIds.includes(userId);
  if (!isOwner && ownerCandidate) isOwner = await isOwnerUser(config, userId);

  let ownerInvocation = false;
  let rawInput = null;

  if (ownerCandidate && isOwner) {
    ownerInvocation = true;
    rawInput = message.content.slice(OWNER_PREFIX.length);
  } else if (message.content.startsWith(prefix)) {
    rawInput = message.content.slice(prefix.length);
  } else {
    return;
  }

  const t = createTranslator(guildConfig?.language ?? 'tr');

  // Bot tarafi susturma: prefix'te SESSIZ (5.5); owner komutlari muaf
  if (!ownerInvocation) {
    const muteMs = await abuseMuteRemaining({ guildId: message.guildId, userId });
    if (muteMs > 0) return;
  }

  const withoutPrefix = rawInput.trim();
  const tokens = tokenize(withoutPrefix);
  const commandName = (tokens.shift() ?? '').toLowerCase();
  if (!commandName) return;

  const command = ownerInvocation
    ? registry.ownerCommands?.get(commandName) ?? registry.ownerAliases?.get(commandName) ?? null
    : registry.commands.get(commandName) ?? registry.aliases?.get(commandName) ?? null;
  if (!command) return; // bilinmeyen komut: sessiz (spam etme)

  // Alt komut cozumu
  let subName = null;
  if (command.subcommands && command.subcommands.length > 0) {
    const first = tokens[0]?.toLowerCase();
    const matched = command.subcommands.find((s) => s.name === first || (s.aliases ?? []).includes(first));
    if (matched) {
      subName = matched.name;
      tokens.shift();
    }
  }
  const active = activeDefinition(command, subName);
  if (!active || (!active.run && command.subcommands?.length > 0)) {
    await message.reply(
      ensureFlags(usageWithErrors(t, command, prefix, [{ arg: 'alt-komut', code: 'required_missing' }])),
    );
    return;
  }

  const guildOnly = command.guildOnly !== false;
  if (guildOnly && !message.guild) {
    await message.reply(ensureFlags(errorTemplate(t('errors.guild_only.title'), [t('errors.guild_only.body')])));
    return;
  }

  // 1) Owner kapi
  const gate = await checkOwnerGate({
    guildId: message.guildId,
    userId,
    commandName: command.name,
    moduleId: command.module,
    isOwner,
  });
  if (gate) {
    // prefix: SESSIZ (kara liste ve owner komutlari)
    if (gate.code === GATE_CODES.BLACKLISTED || command.ownerOnly) return;
    await message.reply(ensureFlags(gateCard(t, gate)));
    return;
  }

  // 2) Modul + sistem katmani (owner komutlari muaf)
  const moduleActive = command.skipModuleCheck
    ? true
    : await isCommandActive({ guildId: message.guildId, command });
  if (!moduleActive) {
    await message.reply(
      ensureFlags(
        warnTemplate(t('errors.module_disabled.title'), [
          t('errors.module_disabled.body', { modul: commandGateLabel(command) }),
        ]),
      ),
    );
    return;
  }

  // 3) Kullanici katmani
  const perm = await canRun({ command, member: message.member, guild: message.guild, isOwner });
  if (!perm.ok) {
    if (perm.reason === 'owner_only' || command.ownerOnly) return; // sessiz
    await message.reply(ensureFlags(permissionCard(t, command, perm)));
    return;
  }

  // 4) Cooldown
  const cd = await checkCooldown({
    userId,
    guildId: message.guildId,
    command: command.name,
    seconds: command.ownerOnly ? 0 : (command.cooldown ?? DEFAULT_COOLDOWN),
    guildSeconds: command.ownerOnly ? 0 : command.cooldownGuild,
  });
  if (cd.limited) {
    await message.reply(
      ensureFlags(
        warnTemplate(t('errors.cooldown.title'), [
          t('errors.cooldown.body', { saniye: Math.ceil((cd.retryAfterMs ?? 0) / 1000) }),
        ]),
      ),
    );
    return;
  }

  // 5) Argumanlar (prefix tarafi)
  const parsed = await parseArgs({
    command: { args: active.args },
    tokens,
    message,
    guild: message.guild,
    client: message.client,
  });

  if (!parsed.ok) {
    const abuse = await markAbuse({ guildId: message.guildId, userId });
    await message.reply(ensureFlags(usageWithErrors(t, command, prefix, parsed.errors)));
    if (abuse.muted) {
      await message.reply(
        ensureFlags(
          warnTemplate(t('errors.abuse_muted.title'), [
            t('errors.abuse_muted.body', { saniye: abuse.muteSeconds }),
          ]),
        ),
      );
    }
    return;
  }

  const ctx = createContext({
    source: 'prefix',
    message,
    command,
    args: parsed.args,
    guildConfig,
    config,
    prefix,
    registry,
  });

  const ok = await executeRun(ctx, active.run, { source: 'prefix' });
  afterCommand(ctx, command, ok);
  await clearAbuse({ guildId: message.guildId, userId });
}

// ---------------------------------------------------------------------------
// Kart ureticileri
// ---------------------------------------------------------------------------

function permissionCard(t, command, perm) {
  if (perm.reason === 'discord_permission' && perm.missing?.length) {
    const lines = [t('errors.no_permission.body')];
    if (command.permission?.node) lines.push(t('errors.no_permission_node', { node: command.permission.node }));
    return errorTemplate(t('errors.no_permission.title'), lines);
  }
  if (perm.reason === 'node') {
    return errorTemplate(t('errors.no_permission.title'), [
      t('errors.no_permission.body'),
      t('errors.no_permission_node', { node: perm.node ?? command.permission?.node ?? '' }),
    ]);
  }
  if (perm.reason === 'rank') {
    return errorTemplate(t('errors.no_permission.title'), [
      t('errors.no_permission.body'),
      t('errors.no_permission_rank', {
        seviye: perm.rank?.required ?? command.permission?.rankLevel ?? '',
        mevcut: perm.rank?.member ?? 0,
      }),
    ]);
  }
  return errorTemplate(t('errors.no_permission.title'), [t('errors.no_permission.body')]);
}

/** Kullanim karti + arg hata detaylari. */
function usageWithErrors(t, command, prefix, errors) {
  const errorLines = (errors ?? []).map((e) => {
    if (e.code === 'required_missing' && e.arg === 'alt-komut') {
      return `- ${t('errors.invalid_usage.body')}`;
    }
    if (e.code === 'required_missing') return `- ${t('args.required_missing', { arg: e.arg })}`;
    return `- ${t(`args.${e.code}`, { token: e.token ?? '', arg: e.arg ?? '', secenekler: e.options ?? '' })}`;
  });

  return usageTemplate(command, {
    prefix,
    note: errorLines.length > 0 ? `**${t('errors.invalid_usage.title')}**\n${errorLines.join('\n')}` : undefined,
    labels: {
      title: t('errors.invalid_usage.title'),
      description: t('errors.invalid_usage.body'),
    },
  });
}

export { ensureFlags };
