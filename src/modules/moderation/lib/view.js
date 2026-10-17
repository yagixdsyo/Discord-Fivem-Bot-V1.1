/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from '../../../ui/templates/base.js';
import { confirm as confirmTemplate, kv, list } from '../../../ui/templates/index.js';
import { button, gallery, row } from '../../../ui/v2.js';
import { colorToInt } from '../../../ui/colors.js';

function sec(iso) {
  const ms = new Date(iso ?? Date.now()).getTime();
  return Math.floor((Number.isFinite(ms) ? ms : Date.now()) / 1000);
}

const PUNISH_STYLE = {
  ban: { emoji: 'BAN', accent: 'error' },
  permaban: { emoji: 'PERMABAN', accent: 'error' },
  mute: { emoji: 'MUTE', accent: 'warn' },
  kick: { emoji: 'KICK', accent: 'error' },
  whitelist: { emoji: 'WHITELIST', accent: 'warn' },
  uyari: { emoji: 'UYARI_VER', accent: 'warn' },
  unban: { emoji: 'UNBAN', accent: 'success' },
  unmute: { emoji: 'UNMUTE', accent: 'success' },
  unwhitelist: { emoji: 'WHITELIST', accent: 'success' },
};

export function typeLabel(t, type, permanent = false) {
  if (type === 'ban' && permanent) return t('moderation.types.permaban');
  return t(`moderation.types.${type}`) ?? type;
}

// ---------------------------------------------------------------------------
// Cezalar
// ---------------------------------------------------------------------------

/** Ban onay onizlemesi. */
export function banPreviewPayload(t, { userId, userTag, accountCreatedSec, warnCount, activeCount, durationText, reason, ownerId }) {
  const description = [
    t('moderation.ban.preview.user', { kullanici: `<@${userId}>`, etiket: userTag ?? userId }),
    t('moderation.ban.preview.account_age', { yas: `<t:${accountCreatedSec}:R>` }),
    t('moderation.ban.preview.warnings', { adet: warnCount }),
    t('moderation.ban.preview.active', { adet: activeCount }),
    durationText
      ? t('moderation.ban.preview.duration', { sure: durationText })
      : t('moderation.ban.preview.permanent'),
    reason ? t('moderation.ban.preview.reason', { sebep: reason }) : null,
  ].filter(Boolean);

  return confirmTemplate({
    title: t('moderation.ban.preview.title'),
    description,
    confirmId: `banonay:${ownerId}`,
    cancelId: `baniptal:${ownerId}`,
    confirmLabel: t('moderation.ban.preview.confirm'),
    danger: true,
  });
}

/** Ceza sonuc karti. */
export function punishmentResultPayload(t, { action, userId, userTag, caseId, reason, durationText, extraLines = [] }) {
  const style = PUNISH_STYLE[action] ?? { emoji: 'CEZA', accent: 'warn' };
  const lines = [
    t('moderation.result.target', { kullanici: `<@${userId}>`, etiket: userTag ?? userId }),
    durationText ? t('moderation.result.duration', { sure: durationText }) : null,
    reason ? t('moderation.result.reason', { sebep: reason }) : null,
    caseId ? t('moderation.result.case', { kod: `\`${caseId}\`` }) : null,
    ...extraLines,
  ].filter(Boolean);

  return card({
    emojiKey: style.emoji,
    title: t(`moderation.result.${action}`),
    lines,
    accent: style.accent,
  });
}

/** Ban listesi (sayfali). */
export function banListPayload(t, { items, page, ownerId, filterLabel = null, pageSize = 8 }) {
  return list({
    emojiKey: 'BAN',
    title: t('moderation.ban_list.title'),
    subtitle: filterLabel ?? undefined,
    items,
    page,
    pageSize,
    namespace: 'banliste',
    ownerId,
    emptyText: t('moderation.ban_list.empty'),
    renderItem: (doc) =>
      t('moderation.ban_list.line', {
        kod: `\`${doc.case_id}\``,
        kullanici: `<@${doc.user_id}>`,
        tur: doc.permanent ? t('moderation.types.permaban') : t('moderation.types.ban'),
        sebep: doc.reason ?? t('common.none'),
        tarih: `<t:${sec(doc.created_at)}:R>`,
      }),
  });
}

/** /bansorgu detay karti. */
export function banQueryPayload(t, { doc, ownerId }) {
  const rows = [
    [t('moderation.query.user'), `<@${doc.user_id}> \`${doc.user_id}\``],
    [t('moderation.query.status'), doc.active ? t('moderation.query.active') : t('moderation.query.lifted')],
    [t('moderation.query.type'), doc.permanent ? t('moderation.types.permaban') : t('moderation.types.ban')],
    [t('moderation.query.reason'), doc.reason ?? t('common.none')],
    [t('moderation.query.actor'), doc.actor_id ? `<@${doc.actor_id}>` : t('common.unknown')],
    [t('moderation.query.date'), `<t:${sec(doc.created_at)}:F> (<t:${sec(doc.created_at)}:R>)`],
    doc.expires_at ? [t('moderation.query.expires'), `<t:${sec(doc.expires_at)}:R>`] : null,
    doc.lifted_at ? [t('moderation.query.lifted_at'), `<t:${sec(doc.lifted_at)}:R>`] : null,
    [t('moderation.query.case'), `\`${doc.case_id}\``],
  ].filter(Boolean);

  const buttons = doc.active
    ? [row([button({ id: `bansorgu:unban:${doc.case_id}:${ownerId}`, label: t('moderation.query.unban_button'), emojiKey: 'UNBAN', style: 'success' })])]
    : undefined;

  return kv({ title: t('moderation.query.title'), emojiKey: 'BAN', accent: 'error', rows, buttons, footer: `\`${doc.case_id}\`` });
}

/** Itiraz listesi (yetkililer icin). */
export function appealListPayload(t, { items, page, ownerId, pageSize = 6 }) {
  return list({
    emojiKey: 'DUYURU',
    title: t('moderation.appeals.title'),
    items,
    page,
    pageSize,
    namespace: 'itirazlar',
    ownerId,
    emptyText: t('moderation.appeals.empty'),
    renderItem: (doc) =>
      t('moderation.appeals.line', {
        kod: `\`${doc.appeal_id}\``,
        kullanici: `<@${doc.user_id}>`,
        durum: t(`moderation.appeals.status.${doc.status}`) ?? doc.status,
        tarih: `<t:${sec(doc.created_at)}:R>`,
      }),
  });
}

// ---------------------------------------------------------------------------
// Uyarilar ve gecmis
// ---------------------------------------------------------------------------

export function warningListPayload(t, { userId, items, page, ownerId, pageSize = 8 }) {
  return list({
    emojiKey: 'UYARI_VER',
    title: t('moderation.warn.list_title', { kullanici: `<@${userId}>` }),
    items,
    page,
    pageSize,
    namespace: 'uyariliste',
    ownerId,
    emptyText: t('moderation.warn.empty'),
    renderItem: (doc) =>
      t('moderation.warn.line', {
        tur: t(`moderation.warn.type.${doc.type}`) ?? doc.type,
        sebep: doc.reason ?? t('common.none'),
        tarih: `<t:${sec(doc.created_at)}:R>`,
        kod: `\`${doc.warning_id}\``,
      }),
  });
}

export function historyPayload(t, { userId, items, page, ownerId, pageSize = 8 }) {
  return list({
    emojiKey: 'CEZA',
    title: t('moderation.history.title', { kullanici: `<@${userId}>` }),
    items,
    page,
    pageSize,
    namespace: 'cezagecmis',
    ownerId,
    emptyText: t('moderation.history.empty'),
    renderItem: (doc) =>
      t('moderation.history.line', {
        emojiKey: null,
        tur: typeLabel(t, doc.type, doc.permanent),
        sebep: doc.reason ?? t('common.none'),
        tarih: `<t:${sec(doc.created_at)}:R>`,
        durum: doc.active ? t('moderation.history.active') : t('moderation.history.lifted'),
        kod: `\`${doc.case_id}\``,
      }),
  });
}

// ---------------------------------------------------------------------------
// Rol islemleri
// ---------------------------------------------------------------------------

export function roleInfoPayload(t, { role, memberCount, dangerous }) {
  const rows = [
    [t('moderation.role.name'), `<@&${role.id}>`],
    [t('moderation.role.id'), `\`${role.id}\``],
    [t('moderation.role.members'), String(memberCount)],
    [t('moderation.role.position'), String(role.position)],
    [t('moderation.role.color'), role.hexColor ?? t('common.none')],
    [t('moderation.role.dangerous'), dangerous ? t('common.yes') : t('common.no')],
    [t('moderation.role.created'), `<t:${sec(role.createdAt)}:R>`],
  ];
  return kv({ title: t('moderation.role.info_title'), emojiKey: 'ROL', accent: 'primary', rows });
}

export function roleLogsPayload(t, { userId, items, page, ownerId, pageSize = 8 }) {
  return list({
    emojiKey: 'BELGE',
    title: t('moderation.role.logs_title', { kullanici: `<@${userId}>` }),
    items,
    page,
    pageSize,
    namespace: 'rollog',
    ownerId,
    emptyText: t('moderation.role.logs_empty'),
    renderItem: (doc) =>
      t('moderation.role.logs_line', {
        islem: doc.action === 'ekle' ? t('moderation.role.added') : t('moderation.role.removed'),
        rol: `<@&${doc.role_id}>`,
        aktor: doc.actor_id ? `<@${doc.actor_id}>` : t('common.unknown'),
        kaynak: t(`moderation.role.via.${doc.via}`) ?? doc.via,
        tarih: `<t:${sec(doc.at)}:R>`,
      }),
  });
}

export function bulkRoleReportPayload(t, { role, action, result }) {
  const lines = [
    t('moderation.bulk.role', { rol: `<@&${role.id}>` }),
    t('moderation.bulk.action', { islem: action === 'ekle' ? t('moderation.role.added') : t('moderation.role.removed') }),
    t('moderation.bulk.ok', { adet: result.ok.length }),
    t('moderation.bulk.skipped', { adet: result.atlanan.length }),
    t('moderation.bulk.missing', { adet: result.yok.length }),
    t('moderation.bulk.failed', { adet: result.hata.length }),
    result.hata.length > 0
      ? t('moderation.bulk.failed_sample', { ornek: result.hata.slice(0, 3).map((item) => item.id).join(', ') })
      : null,
  ].filter(Boolean);
  return card({ emojiKey: 'TOPLU', title: t('moderation.bulk.title'), lines, accent: result.hata.length > 0 ? 'warn' : 'success' });
}

// ---------------------------------------------------------------------------
// Mesaj araclari
// ---------------------------------------------------------------------------

export function silResultPayload(t, { deleted, skippedPinned, skippedOld, transcriptUrl, hasFile }) {
  const lines = [
    t('moderation.clear.deleted', { adet: deleted }),
    skippedPinned > 0 ? t('moderation.clear.skipped_pinned', { adet: skippedPinned }) : null,
    skippedOld > 0 ? t('moderation.clear.skipped_old', { adet: skippedOld }) : null,
    hasFile ? t('moderation.clear.transcript_file') : null,
    transcriptUrl ? t('moderation.clear.transcript_url', { url: transcriptUrl }) : null,
  ].filter(Boolean);
  return card({ emojiKey: 'SIL', title: t('moderation.clear.title'), lines, accent: 'success' });
}

export function snipePayload(t, { kind, entry }) {
  const lines = [
    t('moderation.snipe.author', { kullanici: `<@${entry.authorId}>`, etiket: entry.authorTag ?? '?' }),
    t('moderation.snipe.time', { tarih: `<t:${Math.floor((entry.at ?? Date.now()) / 1000)}:R>` }),
    kind === 'duzenleme' && entry.oldContent
      ? t('moderation.snipe.old', { icerik: String(entry.oldContent).replaceAll('```', '`\u200b``').slice(0, 900) || t('common.none') })
      : null,
    t(kind === 'duzenleme' ? 'moderation.snipe.new' : 'moderation.snipe.content', {
      icerik: String(entry.content ?? '').replaceAll('```', '`\u200b``').slice(0, 900) || t('common.none'),
    }),
    entry.hadAttachments ? t('moderation.snipe.attachments') : null,
  ].filter(Boolean);
  return card({ emojiKey: 'ARAMA', title: t(`moderation.snipe.title_${kind}`), lines, accent: 'info' });
}

export function copyResultPayload(t, { channelRef, hasAttachments }) {
  return card({
    emojiKey: 'KOPYALA',
    title: t('moderation.copy.title'),
    lines: [t('moderation.copy.body', { kanal: channelRef }), hasAttachments ? t('moderation.copy.attachments') : null].filter(Boolean),
    accent: 'success',
  });
}

export function tepkiSayPayload(t, { channelRef, entries }) {
  const lines = entries.map((entry) =>
    t('moderation.reactions.line', { emoji: entry.emoji, adet: entry.count, kisiler: entry.users.map((id) => `<@${id}>`).join(', ') }),
  );
  return card({
    emojiKey: 'YILDIZ',
    title: t('moderation.reactions.title'),
    subtitle: channelRef,
    lines: lines.length > 0 ? lines : [t('moderation.reactions.empty')],
    accent: 'info',
  });
}

export function yazPreviewPayload(t, { title, description, colorHex, imageUrl, buttonLabel, buttonUrl, ownerId }) {
  const rows = [
    row([
      button({ id: `yazgonder:${ownerId}`, label: t('moderation.write.send'), emojiKey: 'OK_SAG', style: 'success' }),
      button({ id: `yaziptal:${ownerId}`, label: t('common.cancel'), emojiKey: 'RED', style: 'secondary' }),
    ]),
  ];
  if (buttonLabel && buttonUrl) {
    rows.push(row([button({ label: buttonLabel, url: buttonUrl, style: 'link' })]));
  }

  return card({
    emojiKey: 'DUYURU',
    title: title || t('moderation.write.preview_title'),
    lines: [description ?? ''],
    accentColor: colorToInt(colorHex),
    buttons: rows,
    fileComponents: imageUrl ? [gallery([imageUrl])] : [],
  });
}

// ---------------------------------------------------------------------------
// Bilgi kartlari
// ---------------------------------------------------------------------------

export function userInfoPayload(t, { userTag, userId, createdSec, joinedSec, roles, activeCount, warnCount, inviteCount, inviterId, voiceText, blacklistText }) {
  const rows = [
    [t('moderation.user_info.user'), `${userTag ?? '?'} (<@${userId}>)`],
    [t('moderation.user_info.id'), `\`${userId}\``],
    [t('moderation.user_info.created'), `<t:${createdSec}:F> (<t:${createdSec}:R>)`],
    joinedSec ? [t('moderation.user_info.joined'), `<t:${joinedSec}:F> (<t:${joinedSec}:R>)`] : null,
    [t('moderation.user_info.active_punish'), String(activeCount)],
    [t('moderation.user_info.warnings'), String(warnCount)],
    [t('moderation.user_info.invites'), String(inviteCount)],
    inviterId ? [t('moderation.user_info.inviter'), `<@${inviterId}>`] : null,
    voiceText ? [t('moderation.user_info.voice'), voiceText] : null,
    blacklistText ? [t('moderation.user_info.blacklist'), blacklistText] : null,
    [t('moderation.user_info.roles'), roles.length > 0 ? roles.slice(0, 12).map((id) => `<@&${id}>`).join(' ') : t('common.none')],
  ].filter(Boolean);
  return kv({ title: t('moderation.user_info.title'), emojiKey: 'KULLANICI', accent: 'info', rows });
}

export function neredePayload(t, { userTag, userId, voiceText, statusText, micText = null, deafText = null, streamText = null, gameText = null }) {
  const rows = [
    [t('common.user'), `${userTag ?? '?'} (<@${userId}>)`],
    [t('moderation.where.voice'), voiceText ?? t('moderation.where.not_voice')],
  ];
  if (micText) rows.push([t('moderation.where.mic'), micText]);
  if (deafText) rows.push([t('moderation.where.deaf'), deafText]);
  if (streamText) rows.push([t('moderation.where.stream'), streamText]);
  rows.push([t('moderation.where.status_label'), statusText]);
  if (gameText) rows.push([t('moderation.where.game'), gameText]);
  return kv({
    title: t('moderation.where.title'),
    emojiKey: 'ARAMA',
    accent: 'info',
    rows,
  });
}

export function sayPayload(t, { counts }) {
  const rows = [
    [t('moderation.say.members'), String(counts.members)],
    [t('moderation.say.online'), String(counts.online)],
    [t('moderation.say.bots'), String(counts.bots)],
    [t('moderation.say.channels'), String(counts.channels)],
    [t('moderation.say.roles'), String(counts.roles)],
    [t('moderation.say.boosts'), `${counts.boosts} (${t('moderation.say.tier')}: ${counts.boostTier})`],
    [t('moderation.say.emojis'), String(counts.emojis)],
  ];
  return kv({ title: t('moderation.say.title', { sunucu: counts.guildName }), emojiKey: 'KULLANICILAR', accent: 'primary', rows });
}

export function serverInfoPayload(t, { guild, counts }) {
  const rows = [
    [t('moderation.server.id'), `\`${guild.id}\``],
    [t('moderation.server.owner'), `<@${guild.ownerId}>`],
    [t('moderation.server.created'), `<t:${sec(guild.createdAt)}:F> (<t:${sec(guild.createdAt)}:R>)`],
    [t('moderation.server.members'), String(counts.members)],
    [t('moderation.server.channels'), String(counts.channels)],
    [t('moderation.server.roles'), String(counts.roles)],
    [t('moderation.server.boosts'), `${counts.boosts} (${t('moderation.say.tier')}: ${counts.boostTier})`],
    [t('moderation.server.locale'), guild.preferredLocale ?? t('common.unknown')],
  ];
  return kv({ title: t('moderation.server.title', { sunucu: guild.name }), emojiKey: 'BILGI', accent: 'primary', rows, subtitle: guild.description ?? undefined });
}

export function statsTextPayload(t, { daily, totals, days }) {
  const lines = [
    t('moderation.stats.totals', { mesaj: totals.messages, ses: formatSeconds(totals.voiceSeconds) }),
    ...daily.slice(-Math.min(days, 14)).map((row) =>
      t('moderation.stats.day_line', {
        gun: row.day,
        mesaj: row.messages,
        ses: formatSeconds(row.voice_seconds),
      }),
    ),
  ];
  return card({ emojiKey: 'GRAFIK', title: t('moderation.stats.title'), lines, accent: 'primary' });
}

export function topPayload(t, { rows, metricText, days }) {
  const lines = rows.map((row, index) =>
    t('moderation.top.line', {
      sira: index + 1,
      kullanici: `<@${row.user_id}>`,
      deger: metricText(row),
    }),
  );
  return card({
    emojiKey: 'LEADERBOARD',
    title: t('moderation.top.title'),
    subtitle: t('moderation.top.subtitle', { gun: days }),
    lines: lines.length > 0 ? lines : [t('common.list_empty')],
    accent: 'primary',
  });
}

export function inviteInfoPayload(t, { userTag, userId, total, inviterId, invited }) {
  const lines = [
    t('moderation.invite.count', { adet: total }),
    inviterId
      ? t('moderation.invite.inviter', { kisi: `<@${inviterId}>` })
      : t('moderation.invite.inviter_unknown'),
    ...invited.slice(0, 10).map((doc) =>
      t('moderation.invite.invited_line', {
        kisi: `<@${doc.invited_id}>`,
        tarih: `<t:${sec(doc.joined_at)}:R>`,
        durum: doc.left ? t('moderation.invite.left') : t('moderation.invite.still'),
      }),
    ),
  ];
  return card({
    emojiKey: 'LINK',
    title: t('moderation.invite.title', { kullanici: userTag ?? `<@${userId}>` }),
    lines,
    accent: 'info',
  });
}

export function inviteLeaderPayload(t, { rows, days }) {
  const lines = rows.map((row, index) =>
    t('moderation.invite.leader_line', {
      sira: index + 1,
      kullanici: `<@${row.inviter_id}>`,
      toplam: row.toplam,
      kalan: row.kalan,
    }),
  );
  return card({
    emojiKey: 'LEADERBOARD',
    title: t('moderation.invite.leader_title'),
    subtitle: t('moderation.top.subtitle', { gun: days }),
    lines: lines.length > 0 ? lines : [t('common.list_empty')],
    accent: 'primary',
  });
}

export function otorolPayload(t, { cfg, guild }) {
  const rows = [
    [t('moderation.autorole.role'), cfg.autoroleId ? `<@&${cfg.autoroleId}>` : t('common.none')],
    [t('moderation.autorole.welcome_channel'), cfg.channelId ? `<#${cfg.channelId}>` : t('common.none')],
    [t('moderation.autorole.dm'), cfg.dm ? t('common.yes') : t('common.no')],
    [t('moderation.autorole.message'), cfg.message],
    [t('moderation.autorole.bye_channel'), cfg.byeChannelId ? `<#${cfg.byeChannelId}>` : t('common.none')],
    [t('moderation.autorole.bye_message'), cfg.byeMessage],
  ];
  return kv({ title: t('moderation.autorole.title', { sunucu: guild.name }), emojiKey: 'ROL_VER', accent: 'primary', rows });
}

export function whitelistPunishPayload(t, { userTag, userId, roleName, durationText, caseId, ownerId: _ownerId }) {
  const lines = [
    t('moderation.result.target', { kullanici: `<@${userId}>`, etiket: userTag ?? userId }),
    t('moderation.whitelist.role_line', { rol: roleName }),
    t('moderation.result.duration', { sure: durationText }),
    t('moderation.result.case', { kod: `\`${caseId}\`` }),
  ];
  return card({ emojiKey: 'WHITELIST', title: t('moderation.whitelist.title'), lines, accent: 'warn' });
}

export function formatSeconds(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return `${hours} sa ${minutes} dk`;
}
