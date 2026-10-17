/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';

async function fetchBuffer(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export default {
  name: 'guildUpdate',
  async execute(oldGuild, newGuild, meta) {
    const guild = newGuild;
    if (!guild?.id) return;

    const vanityChanged = oldGuild?.vanityURLCode !== undefined && newGuild.vanityURLCode !== oldGuild.vanityURLCode;
    const nameChanged = oldGuild?.name !== undefined && newGuild.name !== oldGuild.name;
    const iconChanged = oldGuild?.icon !== undefined && newGuild.icon !== oldGuild.icon;
    const bannerChanged = oldGuild?.banner !== undefined && newGuild.banner !== oldGuild.banner;
    const verificationChanged = oldGuild?.verificationLevel !== undefined && newGuild.verificationLevel !== oldGuild.verificationLevel;
    const afkChannelChanged = oldGuild?.afkChannelId !== undefined && newGuild.afkChannelId !== oldGuild.afkChannelId;
    const afkTimeoutChanged = oldGuild?.afkTimeout !== undefined && newGuild.afkTimeout !== oldGuild.afkTimeout;
    const systemChannelChanged = oldGuild?.systemChannelId !== undefined && newGuild.systemChannelId !== oldGuild.systemChannelId;
    const rulesChannelChanged = oldGuild?.rulesChannelId !== undefined && newGuild.rulesChannelId !== oldGuild.rulesChannelId;
    const localeChanged = oldGuild?.preferredLocale !== undefined && newGuild.preferredLocale !== oldGuild.preferredLocale;

    if (
      !vanityChanged &&
      !nameChanged &&
      !iconChanged &&
      !bannerChanged &&
      !verificationChanged &&
      !afkChannelChanged &&
      !afkTimeoutChanged &&
      !systemChannelChanged &&
      !rulesChannelChanged &&
      !localeChanged
    ) {
      return;
    }

    const { ok } = await guardGate(guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(guild.id);

    // URL/vanity (12.3.4): geri alinamaz -> ban
    if (vanityChanged) {
      if (!config.modules.url.enabled) return;
      const actorResult = await judgeActor({
        guild,
        client: meta?.client,
        config: meta?.config,
        moduleKey: 'url',
        auditType: AuditLogEvent.GuildUpdate,
        targetId: guild.id,
        force: true,
      });
      await handleViolation({
        guild,
        client: meta?.client,
        config,
        moduleKey: 'url',
        type: 'vanity_update',
        description: `Vanity URL değişti: \`${oldGuild.vanityURLCode ?? '-'}\` → \`${newGuild.vanityURLCode ?? '-'}\``,
        actorResult,
        restoreFn: null,
      });
      return;
    }

    // Sunucu ayarlari
    if (!config.modules.sunucu.enabled) return;

    const changes = [];
    if (nameChanged) changes.push(`isim: \`${oldGuild.name}\` → \`${newGuild.name}\``);
    if (iconChanged) changes.push('ikon');
    if (bannerChanged) changes.push('banner');
    if (verificationChanged) changes.push(`doğrulama: ${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`);
    if (afkChannelChanged) changes.push('AFK kanalı');
    if (afkTimeoutChanged) changes.push(`AFK süresi: ${oldGuild.afkTimeout} → ${newGuild.afkTimeout}`);
    if (systemChannelChanged) changes.push('sistem kanalı');
    if (rulesChannelChanged) changes.push('kural kanalı');
    if (localeChanged) changes.push(`dil: ${oldGuild.preferredLocale} → ${newGuild.preferredLocale}`);

    const actorResult = await judgeActor({
      guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'sunucu',
      auditType: AuditLogEvent.GuildUpdate,
      targetId: guild.id,
      force: true,
    });

    const oldIconUrl = oldGuild.icon ? oldGuild.iconURL({ size: 1024, extension: 'png' }) : null;
    const oldBannerUrl = oldGuild.banner ? oldGuild.bannerURL({ size: 2048, extension: 'png' }) : null;

    await handleViolation({
      guild,
      client: meta?.client,
      config,
      moduleKey: 'sunucu',
      type: 'guild_update',
      description: `Sunucu ayarları değişti: ${changes.join(', ')}`,
      actorResult,
      restoreFn: async () => {
        const errors = [];
        const reason = 'Guard: sunucu ayarları geri alındı';
        if (nameChanged) await guild.setName(oldGuild.name, reason).catch(() => errors.push('isim'));
        if (iconChanged) {
          const buffer = oldGuild.icon ? await fetchBuffer(oldIconUrl) : null;
          if (oldGuild.icon && !buffer) errors.push('ikon');
          else await guild.setIcon(buffer, reason).catch(() => errors.push('ikon'));
        }
        if (bannerChanged) {
          const buffer = oldGuild.banner ? await fetchBuffer(oldBannerUrl) : null;
          if (oldGuild.banner && !buffer) errors.push('banner');
          else await guild.setBanner(buffer, reason).catch(() => errors.push('banner'));
        }
        if (verificationChanged) await guild.setVerificationLevel(oldGuild.verificationLevel, reason).catch(() => errors.push('doğrulama'));
        if (afkChannelChanged) await guild.setAFKChannel(oldGuild.afkChannelId ?? null, reason).catch(() => errors.push('AFK kanalı'));
        if (afkTimeoutChanged) await guild.setAFKTimeout(oldGuild.afkTimeout, reason).catch(() => errors.push('AFK süresi'));
        if (systemChannelChanged) await guild.setSystemChannel(oldGuild.systemChannelId ?? null, reason).catch(() => errors.push('sistem kanalı'));
        if (rulesChannelChanged) await guild.setRulesChannel(oldGuild.rulesChannelId ?? null, reason).catch(() => errors.push('kural kanalı'));
        if (localeChanged) await guild.setPreferredLocale(oldGuild.preferredLocale, reason).catch(() => errors.push('dil'));
        return errors.length === 0
          ? { ok: true, target: guild.name }
          : { ok: false, error: `geri alınamadı: ${errors.join(', ')}` };
      },
    });
  },
};
