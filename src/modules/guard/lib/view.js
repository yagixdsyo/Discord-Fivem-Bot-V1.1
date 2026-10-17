/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  confirm as confirmTemplate,
  error as errorTemplate,
  info as infoTemplate,
  warn as warnTemplate,
} from '../../../ui/templates/index.js';
import { button, row, selectMenu } from '../../../ui/v2.js';
import { emoji } from '../../../ui/emoji.js';
import { GUARD_MODULES, PUNISH_LABELS, moduleDef } from './config.js';

export const GUARD_STATUS_PAGE_SIZE = 15;

export function punishLabel(t, punish) {
  const translated = t(`guard.punish.${punish}`);
  if (translated && translated !== `guard.punish.${punish}`) return translated;
  return PUNISH_LABELS[punish] ?? punish ?? '-';
}

export function moduleLine(t, def, cfg) {
  const em = emoji(def.emojiKey) || '';
  const state = cfg.enabled ? t('guard.state.on') : t('guard.state.off');
  return `${em ? `${em} ` : ''}**${def.name}** — ${punishLabel(t, cfg.punish)} • ${t('guard.status.threshold', {
    limit: cfg.limit,
    window: cfg.window,
  })} • ${state}`;
}

/** /guard-durum ana karti. */
export function guardStatusPayload(t, { config, ownerId }) {
  const lines = GUARD_MODULES.map((def) => moduleLine(t, def, config.modules[def.key]));

  return infoTemplate(t('guard.status.title'), lines, {
    buttons: [
      row([
        selectMenu({
          id: `guarddurum:sec:${ownerId}`,
          placeholder: t('guard.status.select'),
          options: GUARD_MODULES.map((def) => ({
            label: def.name,
            value: def.key,
            emojiKey: def.emojiKey,
            description: t('guard.status.option_desc', {
              ceza: punishLabel(t, config.modules[def.key].punish),
              limit: config.modules[def.key].limit,
              pencere: config.modules[def.key].window,
            }),
          })),
        }),
      ]),
      row([
        button({ id: `guarddurum:yenile:${ownerId}`, label: t('guard.buttons.refresh'), emojiKey: 'YENILE', style: 'secondary' }),
        button({ id: `guarddurum:kapat:${ownerId}`, label: t('guard.buttons.close'), emojiKey: 'RED', style: 'secondary' }),
      ]),
    ],
  });
}

/** Tek modul detay karti (guard-durum seciminden). */
export function guardModulePayload(t, { config, moduleKey, ownerId }) {
  const def = moduleDef(moduleKey);
  const cfg = config.modules[moduleKey];
  const em = emoji(def.emojiKey) || '';

  const desc = t(`guard.module_desc.${moduleKey}`);
  const lines = [
    `${t('guard.fields.state')}: **${cfg.enabled ? t('guard.state.on') : t('guard.state.off')}**`,
    `${t('guard.fields.punish')}: **${punishLabel(t, cfg.punish)}**`,
    `${t('guard.fields.threshold')}: **${cfg.limit}** ${t('guard.fields.per_window', { window: cfg.window })}`,
  ];
  if (desc && desc !== `guard.module_desc.${moduleKey}`) lines.push(`-# ${desc}`);

  return infoTemplate(`${em ? `${em} ` : ''}${def.name}`, lines, {
    buttons: [
      row([
        button({
          id: `guarddurum:tgl:${moduleKey}:${ownerId}`,
          label: cfg.enabled ? t('guard.buttons.disable') : t('guard.buttons.enable'),
          emojiKey: cfg.enabled ? 'KILIT' : 'KILIT_ACIK',
          style: cfg.enabled ? 'danger' : 'success',
        }),
        button({ id: `guarddurum:geri:${ownerId}`, label: t('guard.buttons.back'), emojiKey: 'OK_SOL', style: 'secondary' }),
      ]),
    ],
  });
}

/** /guard-ayar sonuc karti. */
export function guardAyarPayload(t, { moduleKey, cfg }) {
  const def = moduleDef(moduleKey);
  return infoTemplate(t('guard.ayar.title', { modul: def?.name ?? moduleKey }), [
    `${t('guard.fields.state')}: **${cfg.enabled ? t('guard.state.on') : t('guard.state.off')}**`,
    `${t('guard.fields.punish')}: **${punishLabel(t, cfg.punish)}**`,
    `${t('guard.fields.threshold')}: **${cfg.limit}** ${t('guard.fields.per_window', { window: cfg.window })}`,
    t('guard.ayar.hint'),
  ]);
}

/** Guvenli liste karti. */
export function guvenliListPayload(t, { entries, extraLines = [] }) {
  const lines = [...extraLines];
  if (entries.length === 0) {
    lines.push(t('guard.safe.empty'));
  } else {
    for (const doc of entries.slice(0, 40)) {
      lines.push(
        `${t('guard.safe.line', {
          kisi: `<@${doc.user_id}>`,
          kademe: doc.tier ?? 4,
          tarih: `<t:${Math.floor(new Date(doc.added_at ?? Date.now()).getTime() / 1000)}:R>`,
        })}`,
      );
    }
    if (entries.length > 40) lines.push(t('guard.safe.more', { adet: entries.length - 40 }));
  }

  return infoTemplate(t('guard.safe.title'), lines);
}

/** Korumali rol listesi. */
export function korumaliListPayload(t, { entries }) {
  const lines = entries.length === 0
    ? [t('guard.protected.empty')]
    : entries.slice(0, 40).map((doc) => `<@&${doc.role_id}> — <t:${Math.floor(new Date(doc.added_at ?? Date.now()).getTime() / 1000)}:R>`);
  return infoTemplate(t('guard.protected.title'), lines);
}

/** Link beyaz listesi. */
export function linkListPayload(t, { entries }) {
  const lines = entries.length === 0
    ? [t('guard.links.empty')]
    : entries.slice(0, 40).map((doc) => `\`${doc.domain}\` — <t:${Math.floor(new Date(doc.added_at ?? Date.now()).getTime() / 1000)}:R>`);
  return infoTemplate(t('guard.links.title'), lines);
}

/** /guard-performans karti. */
export function guardPerformansPayload(t, { days, stats, total, safeCount, undoneCount, byModule }) {
  const ms = (value) => (value === null || value === undefined ? '-' : `${value} ms`);
  const lines = [
    t('guard.perf.range', { gun: days }),
    `${t('guard.perf.total')}: **${total}**`,
    `${t('guard.perf.punished')}: **${stats.count}**`,
    `${t('guard.perf.safe')}: **${safeCount}**`,
    `${t('guard.perf.undone')}: **${undoneCount}**`,
    `${t('guard.perf.median')}: **${ms(stats.median)}**`,
    `${t('guard.perf.p90')}: **${ms(stats.p90)}**`,
    `${t('guard.perf.p99')}: **${ms(stats.p99)}**`,
  ];
  if (byModule.length > 0) {
    lines.push('', t('guard.perf.by_module'));
    for (const item of byModule.slice(0, 8)) {
      const def = moduleDef(item.module);
      lines.push(`- **${def?.name ?? item.module}**: ${item.count}`);
    }
  }
  return infoTemplate(t('guard.perf.title'), lines);
}

/** Gece modu durumu. */
export function nightModePayload(t, { doc }) {
  const lines = [
    `${t('guard.fields.state')}: **${doc.enabled ? t('guard.state.on') : t('guard.state.off')}**`,
    `${t('guard.night.window')}: **${doc.start} - ${doc.end}** (${doc.timezone})`,
    `${t('guard.night.sleeping')}: **${doc.sleeping ? t('guard.night.sleeping_yes', { adet: (doc.snapshot ?? []).length }) : t('guard.state.no')}**`,
    `${t('guard.night.perms')}: ${(doc.perms ?? []).join(', ')}`,
  ];
  return infoTemplate(t('guard.night.title'), lines);
}

/** Raid modu durumu. */
export function raidModePayload(t, { active, remainingSec, cfg }) {
  const lines = [
    `${t('guard.fields.state')}: **${active ? t('guard.raid.active') : t('guard.raid.inactive')}**`,
    active ? t('guard.raid.remaining', { saniye: remainingSec }) : null,
    `${t('guard.raid.threshold')}: **${cfg.limit}/${cfg.window} sn**`,
    t('guard.raid.hint'),
  ].filter(Boolean);
  return active
    ? warnTemplate(t('guard.raid.title'), lines)
    : infoTemplate(t('guard.raid.title'), lines);
}

/** /guard-test simulasyon karti. */
export function guardTestPayload(t, { def, cfg, actorId, verdict, extraLines = [] }) {
  return infoTemplate(t('guard.test.title', { modul: def.name }), [
    `${t('guard.fields.state')}: **${cfg.enabled ? t('guard.state.on') : t('guard.state.off')}**`,
    `${t('guard.fields.punish')}: **${punishLabel(t, cfg.punish)}**`,
    `${t('guard.fields.threshold')}: **${cfg.limit}** ${t('guard.fields.per_window', { window: cfg.window })}`,
    `${t('guard.test.actor')}: <@${actorId}>`,
    '',
    `**${t('guard.test.verdict')}:** ${verdict}`,
    ...extraLines,
    '',
    t('guard.test.note'),
  ]);
}

/** /guard-geri-al onay karti. */
export function guardUndoConfirmPayload(t, { incident, ownerId }) {
  return confirmTemplate({
    title: t('guard.undo.title'),
    description: [
      `${t('guard.undo.incident')}: \`${incident.incident_id}\``,
      `${t('guard.undo.actor')}: <@${incident.actor_id ?? '0'}>`,
      `${t('guard.undo.action')}: **${incident.action ?? '-'}**`,
      ...(incident.payload?.punish?.removedRoles?.length
        ? [t('guard.undo.roles', { adet: incident.payload.punish.removedRoles.length })]
        : []),
      t('guard.undo.hint'),
    ],
    confirmId: `guardgeri:onay:${incident.incident_id}:${ownerId}`,
    cancelId: `guardgeri:iptal:${ownerId}`,
    confirmLabel: t('guard.undo.confirm'),
    cancelLabel: t('guard.buttons.cancel'),
    danger: true,
  });
}

/** Olay listesi (guvenli bilgilendirme / son olaylar). */
export function incidentsPayload(t, { incidents, title }) {
  const lines = incidents.length === 0
    ? [t('guard.incidents.empty')]
    : incidents.map((doc) => {
        const def = moduleDef(doc.module);
        const when = `<t:${Math.floor(new Date(doc.at ?? Date.now()).getTime() / 1000)}:R>`;
        return `**${def?.name ?? doc.module}** — ${doc.actor_id ? `<@${doc.actor_id}>` : t('guard.incidents.unknown_actor')} • ${doc.action ?? '-'} • ${when}`;
      });
  return infoTemplate(title ?? t('guard.incidents.title'), lines);
}

export { errorTemplate };
