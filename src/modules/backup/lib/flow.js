/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { disabledCard } from '../../../ui/templates/base.js';
import {
  confirm as confirmTemplate,
  error as errorTemplate,
  success as successTemplate,
  warn as warnTemplate,
} from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { ensureMessage, waitForInteraction } from '../../setup/lib/interact.js';
import { parseBackupData } from './create.js';
import { deleteBackups, getLatestBackup } from './store.js';
import { planInstall, snapshotGuildView } from './plan.js';
import { applyInstall } from './install.js';
import { getMappedKeepIds } from './mapped.js';
import { installPlanPayload, installResultPayload, lastBackupMissingPayload } from './view.js';

/**
 * @param {object} ctx komut baglami
 * @param {{kinds?: string[], temizle?: boolean, idPrefix?: string, rolesOnly?: boolean, channelsOnly?: boolean}} opts
 */
export async function installFlow(ctx, { kinds = ['manual', 'auto'], temizle = false, idPrefix = 'backupkur', rolesOnly = false, channelsOnly = false } = {}) {
  const t = ctx.t;

  let doc = null;
  for (const kind of kinds) {
    doc = await getLatestBackup(ctx.guild.id, kind);
    if (doc) break;
  }
  if (!doc) {
    await ctx.reply(lastBackupMissingPayload(t, { kinds }));
    return;
  }

  const data = await parseBackupData(doc);
  if (!data) {
    await ctx.reply(errorTemplate(t('backup.missing.corrupt_title'), [t('backup.missing.corrupt_body')]));
    return;
  }

  const keep = await getMappedKeepIds(ctx.guild.id);
  let plan = planInstall(data, snapshotGuildView(ctx.guild), {
    temizle,
    backupAtMs: new Date(doc.created_at).getTime(),
    ...keep,
  });

  if (rolesOnly) {
    plan = { ...plan, createCategories: [], createChannels: [], deleteChannels: [], deleteRoles: [], settings: [] };
  } else if (channelsOnly) {
    plan = { ...plan, createRoles: [], updateRoles: [], deleteRoles: [], settings: [] };
  }

  const ownerId = ctx.user.id;
  const card = installPlanPayload(t, {
    plan,
    kind: doc.kind,
    temizle,
    createdAt: doc.created_at,
    confirmId: `${idPrefix}:onay:${ownerId}`,
    cancelId: `${idPrefix}:iptal:${ownerId}`,
  });

  const message = await ensureMessage(ctx, await ctx.reply(card, { fetchReply: true }));
  if (!message || typeof message.awaitMessageComponent !== 'function') return;

  const decision = await waitForInteraction(message, ownerId);
  if (!decision || decision.customId !== `${idPrefix}:onay:${ownerId}`) {
    if (decision) await decision.update(warnTemplate(t('setup.cancel.title'), [t('setup.cancel.body')])).catch(() => {});
    else await message.edit(disabledCard(card)).catch(() => {});
    return;
  }

  const result = await applyInstall(ctx.guild, data, plan);
  await decision.update(installResultPayload(t, { result, temizle })).catch(() => {});

  const created = result.created ?? {};
  await emitLog(ctx.guild, 'log_backup', {
    actor: ctx.user.id,
    actorTag: ctx.user.username ?? null,
    lines: [
      'İşlem: **Backup kuruldu**',
      `Rol: **${created.roles ?? 0}** kuruldu • **${created.updatedRoles ?? 0}** güncellendi`,
      `Kanal: **${created.categories ?? 0}** kategori • **${created.channels ?? 0}** kanal`,
      result.errors?.length ? `Hata: **${result.errors.length}** (sonuç kartına bakın)` : null,
    ].filter(Boolean),
  });
}

/**
 * Backup silme akisi: onay gerektirir; kalici backuplar korunur.
 * `/backup sil` ve `/backup-sil` ayni akisi kullanir.
 */
export async function deleteFlow(ctx) {
  const t = ctx.t;
  const ownerId = ctx.user.id;
  const confirmCard = confirmTemplate({
    title: t('backup.delete.title'),
    description: [t('backup.delete.body')],
    confirmId: `backupsil:onay:${ownerId}`,
    cancelId: `backupsil:iptal:${ownerId}`,
    danger: true,
    confirmLabel: t('backup.delete.confirm'),
  });

  const message = await ensureMessage(ctx, await ctx.reply(confirmCard, { fetchReply: true }));
  if (!message || typeof message.awaitMessageComponent !== 'function') return;

  const decision = await waitForInteraction(message, ownerId);
  if (!decision || decision.customId !== `backupsil:onay:${ownerId}`) {
    if (decision) await decision.update(warnTemplate(t('setup.cancel.title'), [t('setup.cancel.body')])).catch(() => {});
    else await message.edit(disabledCard(confirmCard)).catch(() => {});
    return;
  }

  const deleted = await deleteBackups(ctx.guild.id);
  await decision.update(
    successTemplate(t('backup.delete.done_title'), [t('backup.delete.done_body', { adet: deleted })]),
  ).catch(() => {});
}
