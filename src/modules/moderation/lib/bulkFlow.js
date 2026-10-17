/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { confirm as confirmTemplate, error as errorTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { bulkRole } from './roles.js';
import { runConfirm } from './uiFlow.js';
import { parseUserId } from './util.js';
import { bulkRoleReportPayload } from './view.js';

export const BULK_MAX = 200;

/** Metin ve/veya dosyadan kullanici id'lerini toplar (en fazla BULK_MAX). */
export async function collectUserIds(ctx, { rest = null, attachment = null } = {}) {
  const ids = new Set();

  if (rest) {
    for (const token of String(rest).split(/[\s,;]+/)) {
      const id = parseUserId(token);
      if (id) ids.add(id);
    }
  }

  if (attachment?.url) {
    try {
      const response = await fetch(attachment.url);
      if (response.ok) {
        const text = await response.text();
        for (const match of text.matchAll(/\d{15,20}/g)) ids.add(match[0]);
      }
    } catch {
      /* dosya okunamadi */
    }
  }

  return [...ids].slice(0, BULK_MAX);
}

/** Kaynak role sahip uyelerin id'leri. */
export async function membersWithRole(guild, roleId) {
  let role = guild.roles.cache.get(roleId);
  if ((role?.members?.size ?? 0) === 0) {
    await guild.members.fetch().catch(() => {});
    role = guild.roles.cache.get(roleId);
  }
  return [...(role?.members?.values() ?? [])].map((member) => member.id);
}

/** Onayli toplu rol uygulama + rapor + log. */
export async function runBulkRole(ctx, { role, userIds, action, source = 'liste' }) {
  const t = ctx.t;
  if (!role || userIds.length === 0) {
    await ctx.reply(errorTemplate(t('moderation.bulk.empty_title'), [t('moderation.bulk.empty_body')]));
    return;
  }

  const ownerId = ctx.user.id;
  const preview = confirmTemplate({
    title: t('moderation.bulk.confirm_title'),
    description: [
      t('moderation.bulk.role', { rol: `<@&${role.id}>` }),
      t('moderation.bulk.action', {
        islem: action === 'ekle' ? t('moderation.role.added') : t('moderation.role.removed'),
      }),
      t('moderation.bulk.count', { adet: userIds.length }),
      source === 'ekip' ? t('moderation.bulk.source_team') : null,
    ].filter(Boolean),
    confirmId: `topluonay:${ownerId}`,
    cancelId: `topluiptal:${ownerId}`,
    confirmLabel: t('common.confirm'),
    danger: true,
  });

  const confirmed = await runConfirm(ctx, {
    payload: preview,
    ownerId,
    confirmId: `topluonay:${ownerId}`,
    cancelId: `topluiptal:${ownerId}`,
  });
  if (!confirmed) return;

  const result = await bulkRole({
    guild: ctx.guild,
    actorMember: ctx.member,
    botMember: ctx.guild.members.me,
    role,
    userIds,
    action,
    via: 'komut',
  });

  await emitLog(ctx.guild, 'log_toplu_rol', {
    actor: ctx.user.id,
    actorTag: ctx.user.username ?? null,
    lines: [
      `Rol: <@&${role.id}>`,
      action === 'ekle' ? 'İşlem: **toplu rol verildi**' : 'İşlem: **toplu rol alındı**',
      `Başarılı: **${result.ok.length}** • Atlanan: **${result.atlanan.length}** • Bulunamayan: **${result.yok.length}** • Hata: **${result.hata.length}**`,
    ],
  }).catch(() => {});

  await ctx.followUp(bulkRoleReportPayload(t, { role, action, result }));
}
