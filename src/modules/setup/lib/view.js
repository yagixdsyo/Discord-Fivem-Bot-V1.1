/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { RoleSelectMenuBuilder } from 'discord.js';
import {
  confirm as confirmTemplate,
  error as errorTemplate,
  info as infoTemplate,
  list as listTemplate,
  warn as warnTemplate,
} from '../../../ui/templates/index.js';
import { progress as progressTemplate } from '../../../ui/templates/progress.js';
import { button, footerLine, row, selectMenu } from '../../../ui/v2.js';
import { emoji } from '../../../ui/emoji.js';
import { PACKAGES } from './catalog.js';
import { SETUP_PHASES } from './engine.js';

/** On kontrol problem kodunu locale anahtarina cevirir. */
export function precheckProblemText(t, code) {
  return t(`setup.precheck.problem_${code}`);
}

export function precheckWarningText(t, code) {
  return t(`setup.precheck.warn_${code}`);
}

/** On kontrol kart dizileri (problems/warnings/mevcut kurulum). */
export function precheckLines(t, evaluation) {
  const lines = [];
  if (evaluation.problems.length > 0) {
    for (const problem of evaluation.problems) lines.push(precheckProblemText(t, problem.code));
  } else {
    lines.push(t('setup.precheck.permissions_ok'));
  }

  if (evaluation.hasExisting) {
    lines.push(
      t('setup.precheck.existing_line', {
        roller: evaluation.existingRoles,
        kanallar: evaluation.existingChannels,
      }),
    );
  } else {
    lines.push(t('setup.precheck.new_line'));
  }

  for (const warning of evaluation.warnings) lines.push(precheckWarningText(t, warning.code));
  return lines;
}

export function precheckCard(t, evaluation) {
  const lines = precheckLines(t, evaluation);
  if (!evaluation.ok) {
    return errorTemplate(t('setup.precheck.title'), lines);
  }
  if (evaluation.warnings.length > 0) {
    return warnTemplate(t('setup.precheck.title'), lines);
  }
  return infoTemplate(t('setup.precheck.title'), lines);
}

// ---------------------------------------------------------------------------
// Sihirbaz
// ---------------------------------------------------------------------------

export function packageOptions(t, current) {
  const active = current instanceof Set ? current : new Set([current ?? 'hepsi']);
  const usingAll = active.has('hepsi');
  return PACKAGES.map((pack) => ({
    label: pack.name,
    value: pack.id,
    emojiKey: pack.emojiKey,
    default: usingAll ? pack.id === 'hepsi' : active.has(pack.id),
  }));
}

/** Sihirbaz karti: paket secimi + oto-rol + yetkili rolu + butonlar. */
export function wizardPayload(t, state) {
  const lines = [t('setup.wizard.body')];
  if (state.precheck?.hasExisting) {
    lines.push(
      t('setup.precheck.existing_line', {
        roller: state.precheck.existingRoles,
        kanallar: state.precheck.existingChannels,
      }),
    );
  }
  if (state.cfxCode) lines.push(t('setup.wizard.cfx_set', { deger: state.cfxCode }));
  if (state.serverIp) lines.push(t('setup.wizard.ip_set', { deger: state.serverIp }));
  for (const warning of state.precheck?.warnings ?? []) {
    lines.push(precheckWarningText(t, warning.code));
  }

  return infoTemplate(t('setup.wizard.title'), lines, {
    buttons: [
      row([
        selectMenu({
          id: `setupwiz:paket:${state.ownerId}`,
          placeholder: t('setup.wizard.package_placeholder'),
          options: packageOptions(t, state.packages),
          min: 1,
          max: PACKAGES.length,
        }),
      ]),
      row([
        new RoleSelectMenuBuilder()
          .setCustomId(`setupwiz:otorol:${state.ownerId}`)
          .setPlaceholder(t('setup.wizard.otorol_placeholder'))
          .setMinValues(0)
          .setMaxValues(1),
      ]),
      row([
        new RoleSelectMenuBuilder()
          .setCustomId(`setupwiz:yetkili:${state.ownerId}`)
          .setPlaceholder(t('setup.wizard.yetkili_placeholder'))
          .setMinValues(0)
          .setMaxValues(1),
      ]),
      row([
        button({ id: `setupwiz:secenek:${state.ownerId}`, label: t('setup.wizard.btn_options'), emojiKey: 'AYAR', style: 'secondary' }),
        button({ id: `setupwiz:baslat:${state.ownerId}`, label: t('setup.wizard.btn_start'), emojiKey: 'ONAY', style: 'success' }),
        button({ id: `setupwiz:iptal:${state.ownerId}`, label: t('setup.wizard.btn_cancel'), emojiKey: 'RED', style: 'danger' }),
      ]),
    ],
    footer: footerLine([t('setup.wizard.footer')]),
  });
}

/** Onay ozeti: "su roller, su kategoriler, su kanallar olusturulacak". */
export function confirmPayload(t, plan, { ownerId, reset = false } = {}) {
  const roleNames = plan.roles.map((r) => r.name).join(', ');
  const categoryNames = plan.categories.map((c) => c.name).join(', ');
  const lines = [
    t('setup.confirm.description'),
    t('setup.confirm.packages_line', { paketler: plan.packages.join(', ') }),
    t('setup.confirm.roles_line', { adet: plan.roles.length, isimler: roleNames }),
    t('setup.confirm.categories_line', { adet: plan.categories.length, isimler: categoryNames }),
    t('setup.confirm.channels_line', { adet: plan.channels.length, loglar: plan.stats.logs }),
  ];
  if (reset) lines.unshift(t('setup.confirm.reset_warning'));

  return confirmTemplate({
    title: t('setup.confirm.title'),
    description: lines,
    confirmId: `setupwiz:onayla:${ownerId}`,
    cancelId: `setupwiz:iptal:${ownerId}`,
    confirmLabel: reset ? t('setup.confirm.reset_confirm') : t('setup.confirm.confirm_confirm'),
    cancelLabel: t('setup.confirm.confirm_cancel'),
    danger: reset,
  });
}

/** Sifirlama onayi. */
export function resetConfirmPayload(t, { ownerId }) {
  return confirmTemplate({
    title: t('setup.reset.title'),
    description: [t('setup.reset.description'), t('setup.reset.data_note')],
    confirmId: `setupwiz:sifirla-onay:${ownerId}`,
    cancelId: `setupwiz:iptal:${ownerId}`,
    confirmLabel: t('setup.reset.confirm'),
    cancelLabel: t('setup.confirm.confirm_cancel'),
    danger: true,
  });
}

/** Ilerleme karti. */
export function progressPayload(t, { index, total, result }) {
  const labels = SETUP_PHASES.map((phase) => t(`setup.phase_${phase}`));
  const done = Math.min(index, total);
  const lines = labels.map((label, i) => {
    if (i < done) return `${emoji('BASARI')} ${label}`.trim();
    if (i === done) return `${emoji('YUKLENIYOR')} ${label}`.trim();
    return `${emoji('BEKLE')} ${label}`.trim();
  });

  if (result) {
    lines.push('');
    lines.push(
      t('setup.progress.counters', {
        roller: result.roles.created + result.roles.adopted,
        kanallar: result.channels.created,
      }),
    );
    if (result.errors?.length > 0) {
      lines.push(t('setup.progress.error_count', { adet: result.errors.length }));
    }
  }

  return progressTemplate({
    title: t('setup.progress.title'),
    done,
    total,
    statusText: lines.join('\n'),
    footer: footerLine([t('setup.progress.footer')]),
    emojiKey: done >= total ? 'BASARI' : 'YUKLENIYOR',
  });
}

/** Ozet karti: olusan kanallar/roller + sonraki adimlar. */
export function summaryPayload(t, result, { channelDocs = [] } = {}) {
  const lines = [];
  lines.push(
    t('setup.summary.counts', {
      rol: result.roles.created + result.roles.adopted,
      kategori: result.categories.created,
      kanal: result.channels.created,
    }),
  );
  lines.push(t('setup.summary.reused', { adet: result.roles.reused + result.categories.reused + result.channels.reused }));

  const linkKeys = ['kurallar', 'duyurular', 'guncellemeler', 'log_guard', 'log_ban', 'panel_ticket'];
  const byKey = new Map(channelDocs.map((d) => [d.key, d.channel_id]));
  const links = linkKeys.filter((key) => byKey.has(key)).map((key) => `<#${byKey.get(key)}>`);
  if (links.length > 0) lines.push(t('setup.summary.links_line', { kanallar: links.join(' ') }));

  if (result.errors?.length > 0) {
    lines.push(t('setup.summary.errors_line', { adet: result.errors.length }));
    const first = result.errors
      .slice(0, 3)
      .map((e) => `\`${e.key}\`: ${e.error}`)
      .join(' | ');
    lines.push(`-# ${first}`);
  }

  lines.push('');
  lines.push(t('setup.summary.next_steps'));
  lines.push(t('setup.summary.next_1'));
  lines.push(t('setup.summary.next_2'));
  lines.push(t('setup.summary.next_3'));

  return infoTemplate(t('setup.summary.title'), lines);
}

/** Sifirlama ozeti. */
export function resetSummaryPayload(t, result) {
  const lines = [t('setup.reset.done_counts', { kanal: result.deletedChannels, rol: result.deletedRoles })];
  if (result.keptChannels > 0) lines.push(t('setup.reset.done_kept', { adet: result.keptChannels }));
  if (result.skippedRoles?.length > 0) lines.push(t('setup.reset.done_skipped', { adet: result.skippedRoles.length }));
  if (result.errors?.length > 0) lines.push(t('setup.summary.errors_line', { adet: result.errors.length }));
  return infoTemplate(t('setup.reset.done_title'), lines);
}

// ---------------------------------------------------------------------------
// Sistem durumu (/sistemdurum)
// ---------------------------------------------------------------------------

export const DURUM_PAGE_SIZE = 6;

function systemStateText(t, system) {
  if (!system.moduleRegistered && !system.enabled) return t('setup.durum.state_not_ready');
  return system.enabled ? t('setup.durum.state_on') : t('setup.durum.state_off');
}

/** Durum listesi: sayfa basina 6 sistem + toggle butonlari + yenile. */
export function durumPayload(t, { systems, page, ownerId }) {
  const renderItem = (system) => {
    const state = systemStateText(t, system);
    const moduleLine = system.moduleRegistered ? '' : ` ${t('setup.durum.module_missing')}`;
    return `${emoji(system.enabled ? 'DURUM_AKTIF' : 'DURUM_KAPALI')} **${system.name}** — ${state}${moduleLine}`;
  };

  const pageItems = systems.slice(page * DURUM_PAGE_SIZE, page * DURUM_PAGE_SIZE + DURUM_PAGE_SIZE);
  const toggleButtons = pageItems.map((system) =>
    button({
      id: `setupdurum:tgl:${system.id}:${page}:${ownerId}`,
      label: `${system.name} · ${system.enabled ? t('setup.durum.btn_close') : t('setup.durum.btn_open')}`,
      style: system.enabled ? 'secondary' : 'success',
    }),
  );

  const extraRows = [];
  if (toggleButtons.length > 0) extraRows.push(row(toggleButtons.slice(0, 3)));
  if (toggleButtons.length > 3) extraRows.push(row(toggleButtons.slice(3, 6)));
  extraRows.push(row([button({ id: `setupdurum:yenile:${page}:${ownerId}`, emojiKey: 'YENILE', label: t('setup.durum.btn_refresh'), style: 'secondary' })]));

  return listTemplate({
    emojiKey: 'AYAR',
    title: t('setup.durum.title'),
    items: systems,
    page,
    pageSize: DURUM_PAGE_SIZE,
    namespace: 'setupdurum',
    ownerId,
    renderItem,
    emptyText: t('common.list_empty'),
    footer: footerLine([t('setup.durum.footer')]),
    extraRows,
  });
}

/** Guard kapatma onayi. */
export function guardConfirmPayload(t, { system, page, ownerId }) {
  return confirmTemplate({
    title: t('setup.guard.title'),
    description: [t('setup.guard.body'), t('setup.guard.notify_note')],
    confirmId: `setupdurum:guard-onay:${system.id}:${page}:${ownerId}`,
    cancelId: `setupdurum:geri:${page}:${ownerId}`,
    confirmLabel: t('setup.guard.confirm'),
    cancelLabel: t('setup.confirm.confirm_cancel'),
    danger: true,
  });
}

/** Sistem kapatma/acma sonuc karti (komutlar icin). */
export function systemToggleCard(t, { system, enabled, reason }) {
  const lines = [
    t(enabled ? 'setup.toggle.on_line' : 'setup.toggle.off_line', { sistem: system.name }),
  ];
  if (reason) lines.push(t('setup.toggle.reason_line', { sebep: reason }));
  if (system.id === 'guard') lines.push(t('setup.guard.notify_note'));
  return infoTemplate(t('setup.toggle.title'), lines);
}
