/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { getGuildConfig, setGuildSetting } from '../../../core/guildSettings.js';
import { card } from '../../../ui/templates/base.js';
import { getColor } from '../../../ui/colors.js';
import { renderStaffPng } from '../../../ui/canvas/staff.js';
import { findDocs, findOneDoc, insertDoc, updateDoc } from '../../fivem/lib/store.js';
import { progressBar } from './bar.js';

const SETTINGS_KEY = 'terfi';
const COL = 'staff_points';

export const DEFAULT_RANK_NAMES = Object.freeze([
  'Yetkili Adayı',
  'Yetkili',
  'Kıdemli Yetkili',
  'Baş Yetkili',
  'Yönetici',
  'Baş Yönetici',
]);

export function defaultConfig() {
  return {
    announceChannelId: null,
    pointsPerTicket: 1,
    basePoints: 10,
    multiplier: 2,
    rankRoleIds: [],
    rankNames: [],
  };
}

/** Terfi ayarlarini okur (varsayilanlarla birlestirir). */
export async function getStaffConfig(guildId) {
  try {
    const cfg = await getGuildConfig(guildId);
    const raw = cfg?.settings?.[SETTINGS_KEY] ?? {};
    return { ...defaultConfig(), ...raw };
  } catch {
    return defaultConfig();
  }
}

/** Terfi ayarlarini gunceller. */
export async function setStaffConfig(guildId, patch = {}) {
  const current = await getStaffConfig(guildId);
  const next = { ...current, ...patch };
  if (Array.isArray(next.rankRoleIds)) next.rankRoleIds = next.rankRoleIds.filter((id) => /^\d{5,25}$/.test(String(id))).slice(0, 12);
  await setGuildSetting(guildId, SETTINGS_KEY, next);
  return next;
}

/**
 * Merdiveni uretir: her rol icin sira, ad ve mutlak puan esigi.
 * Esikler: base, base*carpan, base*carpan^2 ... (varsayilan 2x zorlasir).
 */
export function buildLadder(config) {
  const cfg = { ...defaultConfig(), ...(config ?? {}) };
  const base = Math.max(1, Math.floor(Number(cfg.basePoints) || 10));
  const mult = Math.max(2, Number(cfg.multiplier) || 2);
  const names = Array.isArray(cfg.rankNames) && cfg.rankNames.length ? cfg.rankNames : DEFAULT_RANK_NAMES;

  return (cfg.rankRoleIds ?? []).map((roleId, index) => ({
    index,
    roleId: String(roleId),
    name: String(names[index] ?? `${names[names.length - 1]} ${index + 1}`),
    threshold: Math.round(base * mult ** index),
  }));
}

/** Puanin denk geldigi rutbeyi bulur: { index, current, next }. */
export function computeRank(points, ladder) {
  const p = Math.max(0, Math.floor(Number(points) || 0));
  let index = -1;
  for (let i = 0; i < (ladder ?? []).length; i += 1) {
    if (p >= ladder[i].threshold) index = i;
  }
  return {
    index,
    current: index >= 0 ? ladder[index] : null,
    next: index + 1 < (ladder?.length ?? 0) ? ladder[index + 1] : null,
  };
}

/** Yetkilinin puan kaydi (yoksa sifir kayit). */
export async function getStaff(guildId, userId) {
  const doc = await findOneDoc(COL, { guild_id: guildId, user_id: userId }).catch(() => null);
  return doc ?? { guild_id: guildId, user_id: userId, points: 0, tickets: 0 };
}

/** Puan ekler/cikarir (taban 0) ve guncel kaydi doner. */
export async function addStaffPoints(guildId, userId, delta, { tickets = 0 } = {}) {
  const d = Math.floor(Number(delta) || 0);
  const t = Math.floor(Number(tickets) || 0);
  const existing = await findOneDoc(COL, { guild_id: guildId, user_id: userId }).catch(() => null);

  if (!existing) {
    return insertDoc(COL, {
      guild_id: guildId,
      user_id: userId,
      points: Math.max(0, d),
      tickets: Math.max(0, t),
      updated_at: new Date().toISOString(),
    });
  }

  await updateDoc(
    COL,
    { guild_id: guildId, user_id: userId },
    {
      points: Math.max(0, (Number(existing.points) || 0) + d),
      tickets: Math.max(0, (Number(existing.tickets) || 0) + t),
      updated_at: new Date().toISOString(),
    },
  );
  return findOneDoc(COL, { guild_id: guildId, user_id: userId });
}

/** Puan siralamasi (buyukten kucuge). */
export async function staffLeaderboard(guildId, { limit = 10 } = {}) {
  const rows = await findDocs(COL, { guild_id: guildId }, { sort: { points: -1 }, limit: Math.max(1, limit) }).catch(() => []);
  return rows.map((row, index) => ({
    order: index + 1,
    user_id: row.user_id,
    points: Number(row.points) || 0,
    tickets: Number(row.tickets) || 0,
  }));
}

/**
 * Uyeyi bulundugu puan esigine gore terfi ettirir.
 * @returns {{ok: boolean, promoted: boolean, member?: object, current?: object|null, next?: object|null, index?: number}}
 */
export async function syncStaffRank({ guild, userId, config = null }) {
  const cfg = config ?? (await getStaffConfig(guild.id));
  const ladder = buildLadder(cfg);
  if (!ladder.length) return { ok: true, promoted: false, index: -1, current: null, next: null };

  const staff = await getStaff(guild.id, userId);
  const rank = computeRank(staff.points, ladder);
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return { ok: false, error: 'uye_yok', member: null, ...rank };
  if (!rank.current) return { ok: true, promoted: false, member, ...rank };

  const held = ladder.filter((row) => member.roles.cache.has(row.roleId));
  const top = held.reduce((acc, row) => (acc === null || row.index > acc.index ? row : acc), null);
  if (top && top.index >= rank.current.index) return { ok: true, promoted: false, member, ...rank };

  await member.roles.add(rank.current.roleId, 'Terfi (otomatik)').catch(() => {});
  for (const row of held) {
    if (row.index < rank.current.index) {
      await member.roles.remove(row.roleId, 'Terfi (eski rutbe)').catch(() => {});
    }
  }
  return { ok: true, promoted: true, member, ...rank };
}

/** Terfi duyurusunu canvas ile kanala gonderir. */
export async function announcePromotion({ guild, member, rank, next, points, config = null, t }) {
  const cfg = config ?? (await getStaffConfig(guild.id));
  if (!cfg.announceChannelId || !rank) return false;

  const channel =
    guild.channels.cache.get(cfg.announceChannelId) ??
    (await guild.channels.fetch(cfg.announceChannelId).catch(() => null));
  if (!channel?.send) return false;

  const pointsNum = Math.max(0, Number(points) || 0);
  const target = next?.threshold ?? pointsNum;
  const fileName = `terfi-${member.id}.png`;
  const png = await renderStaffPng({
    title: t('terfi.announce_title'),
    subtitle: t('terfi.announce_sub', { kullanici: member.user?.username ?? member.id }),
    avatarUrl: member.user?.displayAvatarURL?.({ extension: 'png', size: 128 }) ?? null,
    rankName: rank.name,
    nextName: next ? t('terfi.next_rank', { ad: next.name }) : t('terfi.max_rank'),
    points: pointsNum,
    nextPoints: next?.threshold ?? null,
    ratio: next ? pointsNum / Math.max(1, next.threshold) : 1,
    stats: [
      { label: t('terfi.stat_points'), value: `${pointsNum}` },
      { label: t('terfi.stat_rank'), value: rank.name.slice(0, 18) },
    ],
    footer: t('terfi.announce_footer'),
    accent: getColor('success'),
  });

  return channel
    .send(
      card({
        emojiKey: 'TERFI',
        title: t('terfi.announce_title'),
        subtitle: t('terfi.announce_sub', { kullanici: member.user?.username ?? member.id }),
        lines: [
          t('terfi.announce_line', { kullanici: `<@${member.id}>`, rutbe: `**${rank.name}**`, rol: `<@&${rank.roleId}>` }),
          next
            ? t('terfi.progress_line', {
                bar: progressBar(pointsNum, next.threshold),
                puan: pointsNum,
                hedef: next.threshold,
                sonraki: next.name,
              })
            : t('terfi.max_rank_line', { bar: progressBar(1, 1) }),
        ],
        accent: 'success',
        imageUrls: png ? [`attachment://${fileName}`] : [],
        files: png ? [new AttachmentBuilder(png, { name: fileName })] : [],
        footer: t('terfi.announce_footer'),
      }),
    )
    .catch(() => false);
}

/**
 * Ticket kapaninca puan islemi (closeFlow'dan cagrilir).
 * Puan claim eden yetkiliye (yoksa kapatan yetkiliye) yazilir.
 */
export async function awardTicketPoints({ guild, ticket, by, t }) {
  const staffId = ticket?.claimed_by ?? by ?? null;
  if (!staffId || staffId === ticket?.user_id) return null;

  const cfg = await getStaffConfig(guild.id);
  const delta = Math.max(1, Math.floor(Number(cfg.pointsPerTicket) || 1));
  const staff = await addStaffPoints(guild.id, staffId, delta, { tickets: 1 });
  const result = await syncStaffRank({ guild, userId: staffId, config: cfg });

  let announced = false;
  if (result.ok && result.promoted) {
    announced = Boolean(
      await announcePromotion({
        guild,
        member: result.member,
        rank: result.current,
        next: result.next,
        points: staff.points,
        config: cfg,
        t,
      }),
    );
  }

  return {
    staffId,
    delta,
    points: Number(staff.points) || 0,
    promoted: Boolean(result.ok && result.promoted),
    rank: result.current ?? null,
    announced,
  };
}
