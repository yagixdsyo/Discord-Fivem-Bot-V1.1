/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { OverwriteType } from 'discord.js';

/** Kanal turu etiketi. */
export function channelTypeLabel(type) {
  const map = {
    0: 'yazı',
    2: 'ses',
    4: 'kategori',
    5: 'duyuru',
    13: 'sahne',
    15: 'forum',
    16: 'medya',
  };
  return map[type] ?? String(type);
}

/** Bigint bitfield'daki acik bit sayisi. */
export function countBits(value) {
  return String(value ?? 0n)
    .replace(/[^1]/g, '')
    .length;
}

/** Izin overwrite hedefini mention'a cevirir. */
export function overwriteTarget(overwrite) {
  const id = overwrite?.id;
  if (!id) return 'bilinmiyor';
  if (overwrite.type === OverwriteType.Role) return `<@&${id}>`;
  if (overwrite.type === OverwriteType.Member) return `<@${id}>`;
  return id;
}

/** Iki kanalin izin overwrite farklarini satir listesi olarak doner. */
export function permissionDiff(oldChannel, newChannel) {
  const oldCache = oldChannel?.permissionOverwrites?.cache;
  const newCache = newChannel?.permissionOverwrites?.cache;
  if (!oldCache || !newCache) return null;

  const lines = [];
  for (const [id, overwrite] of oldCache) {
    if (!newCache.has(id)) lines.push(`Kaldırıldı: ${overwriteTarget(overwrite)}`);
  }
  for (const [id, overwrite] of newCache) {
    if (!oldCache.has(id)) {
      lines.push(`Eklendi: ${overwriteTarget(overwrite)}`);
      continue;
    }
    const oldOverwrite = oldCache.get(id);
    const allowChanged =
      BigInt(newOverwriteBit(overwrite, 'allow')) !== BigInt(newOverwriteBit(oldOverwrite, 'allow'));
    const denyChanged =
      BigInt(newOverwriteBit(overwrite, 'deny')) !== BigInt(newOverwriteBit(oldOverwrite, 'deny'));
    if (allowChanged || denyChanged) lines.push(`Güncellendi: ${overwriteTarget(overwrite)}`);
  }

  return lines.length > 0 ? lines : null;
}

function newOverwriteBit(overwrite, field) {
  const value = overwrite?.[field];
  if (value === undefined || value === null) return 0n;
  return BigInt(value.bitfield ?? value);
}

/** Guvenli mention: snowflake ise mention, degilse duz metin. */
export function safeMention(id, { role = false } = {}) {
  if (id === null || id === undefined) return null;
  if (/^\d{15,25}$/.test(String(id))) return role ? `<@&${id}>` : `<@${id}>`;
  return String(id);
}
