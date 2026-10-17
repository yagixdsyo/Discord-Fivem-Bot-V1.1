/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ActivityType } from 'discord.js';
import { card } from '../../../ui/templates/base.js';
import { getSetting, setSetting } from './state.js';

export const PRESENCE_KEY = 'fivem.durumKontrol';

export async function getPresenceConfig(guildId) {
  const raw = await getSetting(guildId, PRESENCE_KEY);
  return {
    enabled: raw?.enabled === true,
    channelId: raw?.channelId ?? null,
    roleId: raw?.roleId ?? null,
    intervalMinutes: Math.max(5, Math.min(1440, Number(raw?.intervalMinutes) || 60)),
    pingMembers: raw?.pingMembers !== false,
    keywords: Array.isArray(raw?.keywords) ? raw.keywords.filter(Boolean).slice(0, 10) : [],
    messageId: raw?.messageId ?? null,
    lastRunAt: raw?.lastRunAt ?? null,
    lastMissing: Number(raw?.lastMissing) || 0,
  };
}

export async function setPresenceConfig(guildId, patch = {}) {
  const current = await getPresenceConfig(guildId);
  const merged = { ...current, ...patch };
  await setSetting(guildId, PRESENCE_KEY, merged);
  return merged;
}

/** Uyeleri tarar: durumu eksikler + cevrimdisilar. */
export async function scanPresence(guild, { config = null } = {}) {
  const cfg = config ?? (await getPresenceConfig(guild.id));
  const vanity = guild.vanityURLCode ? `discord.gg/${guild.vanityURLCode}`.toLowerCase() : null;
  const guildName = String(guild.name ?? '').toLowerCase();
  const keywords = (cfg.keywords ?? []).map((word) => String(word).toLowerCase());

  let members;
  if (cfg.roleId) {
    const role =
      guild.roles?.cache?.get?.(cfg.roleId) ?? (await guild.roles?.fetch?.(cfg.roleId).catch(() => null));
    members = role ? [...(role.members?.values() ?? [])] : [];
  } else {
    members = [...(guild.members.cache?.values?.() ?? [])];
    if (!members.length) {
      const fetched = await guild.members.fetch().catch(() => null);
      members = fetched ? [...fetched.values()] : [];
    }
  }

  const missing = [];
  const offline = [];
  let checked = 0;

  for (const member of members) {
    if (member.user?.bot) continue;
    if (!member.presence) {
      offline.push(member.id);
      continue;
    }
    checked += 1;
    const custom = member.presence.activities?.find((activity) => activity.type === ActivityType.Custom);
    const state = String(custom?.state ?? '').toLowerCase();
    const ok =
      (vanity && state.includes(vanity)) ||
      (guildName && state.includes(guildName)) ||
      keywords.some((word) => word && state.includes(word));
    if (!ok) missing.push(member.id);
  }

  return { checked, missing, offline, vanity };
}

function mentionList(ids, limit = 40) {
  return ids.slice(0, limit).map((id) => `<@${id}>`).join(', ');
}

/**
 * Tek tur kontrol: tarar, kanala yeni kart gonderir (etiket bildirimi icin),
 * onceki tur mesajini siler ve durumu kaydeder.
 */
export async function runPresenceCheck(guild, { t, config = null, force = false, now = Date.now() } = {}) {
  const cfg = config ?? (await getPresenceConfig(guild.id));
  if (!cfg.channelId) return { skipped: true, reason: 'kanal_yok' };
  if (!cfg.enabled && !force) return { skipped: true, reason: 'kapali' };
  if (!force && cfg.lastRunAt) {
    const diff = now - Date.parse(cfg.lastRunAt);
    if (Number.isFinite(diff) && diff >= 0 && diff < cfg.intervalMinutes * 60_000) {
      return { skipped: true, reason: 'bekliyor', waitMs: cfg.intervalMinutes * 60_000 - diff };
    }
  }

  const scan = await scanPresence(guild, { config: cfg });
  const channel = guild.channels.cache.get(cfg.channelId) ?? (await guild.channels.fetch(cfg.channelId).catch(() => null));
  if (!channel?.send) return { ok: false, error: 'kanal_yok' };

  const pingIds = cfg.pingMembers ? [...new Set([...scan.missing, ...scan.offline])] : [];
  const lines = [
    t('fivem.check.auto_scanned', {
      kontrol: scan.checked,
      eksik: scan.missing.length,
      offline: scan.offline.length,
    }),
    scan.missing.length
      ? t('fivem.check.auto_missing', { liste: mentionList(scan.missing) })
      : t('fivem.check.auto_missing_ok'),
    scan.offline.length
      ? t('fivem.check.auto_offline', { liste: mentionList(scan.offline) })
      : t('fivem.check.auto_offline_ok'),
    pingIds.length ? mentionList(pingIds, 50) : null,
  ].filter(Boolean);

  const payload = card({
    emojiKey: 'ARAMA',
    title: t('fivem.check.auto_title'),
    subtitle: t('fivem.check.auto_sub', { sunucu: guild.name }),
    lines,
    accent: scan.missing.length + scan.offline.length ? 'warn' : 'success',
    footer: t('fivem.check.auto_footer', { dakika: cfg.intervalMinutes }),
  });

  const previousId = cfg.messageId;
  const sent = await channel.send(payload).catch(() => null);
  if (sent?.id) {
    await setPresenceConfig(guild.id, { messageId: sent.id });
    if (previousId && previousId !== sent.id) {
      const old = await channel.messages.fetch(previousId).catch(() => null);
      if (old) await old.delete().catch(() => {});
    }
  }

  await setPresenceConfig(guild.id, {
    lastRunAt: new Date(now).toISOString(),
    lastMissing: scan.missing.length + scan.offline.length,
  });

  return { ok: true, checked: scan.checked, missing: scan.missing, offline: scan.offline, sent: Boolean(sent) };
}
