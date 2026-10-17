/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getGuardConfig, getLinkWhitelist, isSafeActor } from '../lib/config.js';
import { guardGate, recordAndLog } from '../lib/pipeline.js';
import { containsBadWord, createSpamTracker, findLinkViolation } from '../lib/content.js';
import { hitLimit } from '../lib/rate.js';

const spamTracker = createSpamTracker({});
const whitelistCache = new Map(); // guildId -> {at, domains}
const WHITELIST_TTL_MS = 60_000;
const TIMEOUT_MS = 10 * 60 * 1000;

function truncate(value, limit) {
  const str = String(value ?? '');
  return str.length <= limit ? str : `${str.slice(0, limit - 3)}...`;
}

async function whitelistFor(guildId) {
  const cached = whitelistCache.get(guildId);
  if (cached && Date.now() - cached.at < WHITELIST_TTL_MS) return cached.domains;
  const docs = await getLinkWhitelist(guildId);
  const domains = docs.map((doc) => doc.domain);
  whitelistCache.set(guildId, { at: Date.now(), domains });
  return domains;
}

export default {
  name: 'messageCreate',
  async execute(message, meta) {
    const guild = message?.guild;
    if (!guild) return;
    if (message.author?.bot || message.webhookId) return;

    const content = message.content ?? '';
    if (!content) return;

    const prefix = meta?.config?.prefix;
    if (prefix && content.startsWith(prefix)) return; // komut mesajlari taranmaz

    const mentionHit = Boolean(message.mentions?.everyone);

    const { ok } = await guardGate(guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(guild.id);
    const mentionOn = config.modules.mention.enabled;
    const contentOn = config.modules.icerik.enabled;
    if (!contentOn && !(mentionOn && mentionHit)) return;

    const chatSafe = config.chatSafe ?? {};
    if ((chatSafe.channels ?? []).includes(message.channelId)) return;
    if ((chatSafe.roles ?? []).some((roleId) => message.member?.roles?.cache?.has(roleId))) return;

    // Guvenli aktor / sahip / bot: islem yapilmaz, loglanir
    const safeInfo = await isSafeActor({
      guildId: guild.id,
      actorId: message.author.id,
      moduleKey: mentionHit ? 'mention' : 'icerik',
      guildOwnerId: guild.ownerId,
      clientUserId: meta?.client?.user?.id ?? null,
      botOwnerIds: meta?.config?.ownerIds ?? [],
    });
    const exempt = guild.ownerId === message.author.id || safeInfo.safe || message.author.id === meta?.client?.user?.id;

    if (exempt) {
      await recordAndLog({
        guild,
        moduleKey: mentionHit ? 'mention' : 'icerik',
        type: 'content_exempt',
        actorId: message.author.id,
        actorTag: message.author.username ?? null,
        target: `<#${message.channelId}>`,
        description: 'Güvenli kullanıcı içerik işlemi',
        action: 'loglandi',
        safe: true,
        extraLines: [`Mesaj: ${truncate(content, 100)}`],
      });
      return;
    }

    const violations = [];
    if (mentionOn && mentionHit) violations.push({ moduleKey: 'mention', kind: 'mention', text: '@everyone/@here etiketleme' });

    if (contentOn) {
      const spam = spamTracker.check(message.author.id, content);
      if (spam.spam) {
        violations.push({
          moduleKey: 'icerik',
          kind: 'spam',
          text: spam.reason === 'tekrar' ? `tekrarlayan mesaj (${spam.count}x)` : `mesaj hızı (${spam.count} mesaj)`,
        });
      }

      const whitelist = await whitelistFor(guild.id);
      const link = findLinkViolation(content, {
        whitelist,
        blockAllLinks: chatSafe.blockAllLinks === true,
      });
      if (link) {
        violations.push({
          moduleKey: 'icerik',
          kind: link.kind,
          text: link.kind === 'davet' ? `davet linki: ${link.url}` : `izinsiz link: ${link.url}`,
        });
      }

      const badWord = containsBadWord(content, chatSafe.badWords);
      if (badWord) violations.push({ moduleKey: 'icerik', kind: 'kufur', text: `yasaklı kelime` });
    }

    if (violations.length === 0) return;

    // 1) Mesaji sil
    let deleted = false;
    try {
      await message.delete();
      deleted = true;
    } catch {
      /* silme yetkisi yok */
    }

    // 2) Esik -> timeout (kademeli: sil -> uyar -> sustur)
    const primary = violations.find((v) => v.moduleKey === 'mention') ?? violations[0];
    const cfg = config.modules[primary.moduleKey];
    const rate = await hitLimit({
      guildId: guild.id,
      module: primary.moduleKey,
      actorId: message.author.id,
      limit: cfg.limit,
      windowSec: cfg.window,
    });

    let action = deleted ? 'sil' : 'atlandi';
    if (rate.exceeded) {
      try {
        await message.member?.timeout?.(TIMEOUT_MS, 'Guard: içerik ihlali');
        action = 'sustur';
      } catch {
        /* timeout uygulanamadi */
      }
    }

    await recordAndLog({
      guild,
      moduleKey: primary.moduleKey,
      type: 'content_violation',
      actorId: message.author.id,
      actorTag: message.author.username ?? null,
      target: `<#${message.channelId}>`,
      description: `İçerik ihlali: ${violations.map((v) => v.kind).join(', ')}`,
      action,
      restored: deleted,
      extraLines: [
        ...violations.map((v) => `İhlal: ${v.text}`),
        `Eşik: **${rate.count}/${rate.limit}** (${cfg.window} sn)`,
        `Mesaj: ${truncate(content, 120)}`,
      ],
    });
  },
};
