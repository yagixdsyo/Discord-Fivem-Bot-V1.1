/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from '../../../ui/templates/base.js';
import { error as errorTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { scheduleTask } from './schedule.js';
import { addPunishment } from './store.js';

/** Sebep metni (ctx.args.sebep), kirpilir. */
export function reasonText(ctx, max = 380) {
  const raw = ctx.args?.sebep ?? '';
  const text = String(raw ?? '').trim();
  return text ? text.slice(0, max) : null;
}

/** Ortak hedef guvenligi: kendine/bota/sunucu sahibine islem yok. */
export function ensureTargetNotProtected(ctx, targetUserId) {
  if (targetUserId === ctx.user.id) return 'self';
  if (targetUserId === ctx.client.user?.id) return 'bot_self';
  if (targetUserId === ctx.guild.ownerId) return 'owner';
  return null;
}

/** Ortak hiyerarsi kontrolu (aktor + bot). */
function ensureHierarchy(ctx, targetMember, permission) {
  const me = ctx.guild.members.me;
  if (permission && !me?.permissions?.has?.(permission)) return 'bot_perm';
  if (targetMember) {
    const actorIsOwner = ctx.guild.ownerId === ctx.user.id;
    if (!actorIsOwner && ctx.member && targetMember.roles.highest.position >= ctx.member.roles.highest.position) {
      return 'hierarchy';
    }
    if (me.roles.highest.position <= targetMember.roles.highest.position) return 'bot_hierarchy';
  }
  return null;
}

/** Genel ceza izin kontrolu (ban/kick/mute ortak). */
export function ensurePunishAllowed(ctx, { targetUserId, targetMember, permission }) {
  return ensureTargetNotProtected(ctx, targetUserId) ?? ensureHierarchy(ctx, targetMember, permission);
}

export function ensureBanAllowed(ctx, { targetUserId, targetMember }) {
  return ensurePunishAllowed(ctx, { targetUserId, targetMember, permission: 'BanMembers' });
}

export function ensureModerateAllowed(ctx, { targetUserId, targetMember }) {
  return ensurePunishAllowed(ctx, { targetUserId, targetMember, permission: 'ModerateMembers' });
}

/** Hata anahtarindan standart hata karti. */
export function punishErrorCard(t, key) {
  return errorTemplate(t(`moderation.errors.${key}.title`), [t(`moderation.errors.${key}.body`)]);
}

/** Cezayi uygular: Discord ban + kayit + (sureliyse) unban gorevi. */
export async function applyBan(ctx, { targetUser, durationMs = null, permanent = false, reason = null }) {
  try {
    await ctx.guild.bans.create(targetUser.id, reason ? { reason } : undefined);
  } catch (error) {
    return { ok: false, key: 'discord', error: String(error?.message ?? error) };
  }

  const doc = await addPunishment({
    guildId: ctx.guild.id,
    userId: targetUser.id,
    userName: targetUser.username ?? null,
    type: 'ban',
    reason,
    actorId: ctx.user.id,
    actorTag: ctx.user.username ?? null,
    durationMs,
    permanent,
  });

  if (durationMs) {
    await scheduleTask({
      guildId: ctx.guild.id,
      kind: 'unban',
      runAt: new Date(Date.now() + durationMs),
      payload: { guildId: ctx.guild.id, userId: targetUser.id, caseId: doc.case_id },
    }).catch(() => {});
  }

  return { ok: true, doc };
}

/** Ceza logu (log_ban vb.). */
export async function logPunishment(ctx, { key, targetUserId, targetTag = null, reason = null, lines = [], accent = 'error' }) {
  await emitLog(ctx.guild, key, {
    actor: ctx.user.id,
    actorTag: ctx.user.username ?? null,
    target: targetUserId,
    targetTag,
    reason,
    lines,
    accent,
  }).catch(() => {});
}

/** Hedefe DM (best effort). */
export async function dmCard(user, payload) {
  try {
    await user.send(payload);
    return true;
  } catch {
    return false;
  }
}

/** Ceza DM karti (ban/kick/mute ortak gorunum). */
export function punishmentDmCard(t, { emojiKey = 'BAN', title, durationText = null, reason = null, guildName }) {
  return card({
    emojiKey,
    title,
    lines: [
      t('moderation.dm.guild', { sunucu: guildName }),
      durationText ? t('moderation.dm.duration', { sure: durationText }) : null,
      reason ? t('moderation.dm.reason', { sebep: reason }) : null,
      t('moderation.dm.contact'),
    ].filter(Boolean),
    accent: 'error',
  });
}
