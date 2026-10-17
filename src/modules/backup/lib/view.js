/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { confirm as confirmTemplate, error as errorTemplate, info as infoTemplate, success as successTemplate, warn as warnTemplate } from '../../../ui/templates/index.js';

const KIND_LABELS = {
  manual: 'Güncel',
  auto: 'Otomatik',
  pre: 'Saldırı Öncesi',
  permanent: 'Kalıcı',
};

function whenText(ts) {
  if (!ts) return '-';
  return `<t:${Math.floor(new Date(ts).getTime() / 1000)}:F>`;
}

function sizeText(size) {
  const kb = (Number(size) || 0) / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
}

function countsText(counts = {}) {
  return `${counts.roles ?? 0} rol • ${counts.channels ?? 0} kanal • ${counts.emojis ?? 0} emoji`;
}

export function backupListPayload(t, { docs }) {
  const lines = docs.length === 0
    ? [t('backup.list.empty')]
    : docs.slice(0, 15).map((doc) => {
        const kind = KIND_LABELS[doc.kind] ?? doc.kind;
        return `**${kind}** — ${whenText(doc.created_at)} • ${sizeText(doc.size)} • ${countsText(doc.counts)}`;
      });
  return infoTemplate(t('backup.list.title'), lines);
}

export function backupSummaryPayload(t, { result }) {
  return successTemplate(t('backup.taken.title'), [
    `${t('backup.fields.kind')}: **${KIND_LABELS[result.kind] ?? result.kind}**`,
    `${t('backup.fields.when')}: ${whenText(result.createdAt)}`,
    `${t('backup.fields.size')}: **${sizeText(result.size)}**`,
    countsText(result.counts),
    '',
    t('backup.taken.hint'),
  ]);
}

export function lastBackupMissingPayload(t, { kinds }) {
  return errorTemplate(t('backup.missing.title'), [
    t('backup.missing.body', { tur: kinds.map((kind) => KIND_LABELS[kind] ?? kind).join(', ') }),
    t('backup.missing.hint'),
  ]);
}

export function installPlanPayload(t, { plan, kind, temizle, createdAt, confirmId = null, cancelId = null, confirmLabel = null }) {
  const counts = plan.counts;
  const lines = [
    `${t('backup.fields.kind')}: **${KIND_LABELS[kind] ?? kind}** (${whenText(createdAt)})`,
    '',
    `${t('backup.plan.create_roles')}: **${counts.createRoles}**`,
    `${t('backup.plan.update_roles')}: **${counts.updateRoles}**`,
    `${t('backup.plan.create_channels')}: **${counts.createCategories}** ${t('backup.plan.categories_note')} + **${counts.createChannels}**`,
    `${t('backup.plan.settings')}: **${counts.settings}**`,
  ];

  if (temizle) {
    lines.push(`${t('backup.plan.delete_channels')}: **${counts.deleteChannels}**`);
    lines.push(`${t('backup.plan.delete_roles')}: **${counts.deleteRoles}**`);
  }

  const createRoleNames = plan.createRoles.slice(0, 10).map((role) => `@${role.name}`);
  if (createRoleNames.length > 0) lines.push(`-# ${t('backup.plan.roles_line')}: ${createRoleNames.join(', ')}`);

  const createChannelNames = [...plan.createCategories, ...plan.createChannels].slice(0, 10).map((channel) => `#${channel.name}`);
  if (createChannelNames.length > 0) lines.push(`-# ${t('backup.plan.channels_line')}: ${createChannelNames.join(', ')}`);

  if (temizle && (plan.deleteChannels.length > 0 || plan.deleteRoles.length > 0)) {
    const deletes = [...plan.deleteChannels.map((item) => `#${item.name}`), ...plan.deleteRoles.map((item) => `@${item.name}`)];
    lines.push(`-# ${t('backup.plan.delete_line')}: ${deletes.slice(0, 10).join(', ')}`);
  }

  for (const warning of plan.warnings.slice(0, 5)) lines.push(`-# ${t('backup.plan.warning')}: ${warning}`);

  lines.push('', t('backup.plan.confirm_hint'));

  return confirmTemplate({
    title: t('backup.plan.title'),
    description: lines,
    confirmId,
    cancelId,
    confirmLabel: confirmLabel ?? undefined,
  });
}

export function installResultPayload(t, { result, temizle }) {
  const lines = [
    `${t('backup.result.roles')}: **${result.created.roles}**`,
    `${t('backup.result.channels')}: **${result.created.categories} + ${result.created.channels}**`,
    `${t('backup.result.updated')}: **${result.created.updatedRoles}**`,
    `${t('backup.result.settings')}: **${result.created.settings}**`,
  ];
  if (temizle) lines.push(`${t('backup.result.deletes')}: **${result.created.deletes}**`);
  if (result.remapped > 0) lines.push(`${t('backup.result.remapped')}: **${result.remapped}** ${t('backup.result.remapped_note')}`);

  if (result.errors.length > 0) {
    lines.push('', t('backup.result.errors', { adet: result.errors.length }));
    for (const error of result.errors.slice(0, 8)) lines.push(`-# ${error}`);
  } else {
    lines.push('', t('backup.result.clean'));
  }

  return result.errors.length === 0
    ? successTemplate(t('backup.result.title'), lines)
    : warnTemplate(t('backup.result.title_partial'), lines);
}

export function roleRestorePayload(t, { roleName, mode, error }) {
  if (mode === 'created') {
    return successTemplate(t('backup.role.created_title', { rol: roleName }), [t('backup.role.created_body')]);
  }
  if (mode === 'updated') {
    return infoTemplate(t('backup.role.updated_title', { rol: roleName }), [t('backup.role.updated_body')]);
  }
  return errorTemplate(t('backup.role.failed_title', { rol: roleName }), [t('backup.role.failed_body', { hata: error ?? '-' })]);
}

export function channelRestorePayload(t, { channelName, mode, error }) {
  if (mode === 'created') {
    return successTemplate(t('backup.channel.created_title', { kanal: channelName }), [t('backup.channel.created_body')]);
  }
  if (mode === 'exists') {
    return infoTemplate(t('backup.channel.exists_title', { kanal: channelName }), [t('backup.channel.exists_body')]);
  }
  return errorTemplate(t('backup.channel.failed_title', { kanal: channelName }), [t('backup.channel.failed_body', { hata: error ?? '-' })]);
}

export function serverRestorePayload(t, { result }) {
  const lines = [
    `${t('backup.result.roles')}: **${result.created.roles}**`,
    `${t('backup.result.channels')}: **${result.created.categories + result.created.channels}**`,
    `${t('backup.result.updated')}: **${result.created.updatedRoles}**`,
  ];
  if (result.errors.length > 0) {
    lines.push('', t('backup.result.errors', { adet: result.errors.length }));
    for (const error of result.errors.slice(0, 8)) lines.push(`-# ${error}`);
  } else {
    lines.push('', t('backup.result.clean'));
  }
  return result.errors.length === 0
    ? successTemplate(t('backup.result.title'), lines)
    : warnTemplate(t('backup.result.title_partial'), lines);
}

export { errorTemplate };
