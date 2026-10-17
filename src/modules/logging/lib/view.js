/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { confirm as confirmTemplate, error as errorTemplate, info as infoTemplate } from '../../../ui/templates/index.js';
import { pageButtons } from '../../../ui/paginator.js';
import { button, footerLine, row, selectMenu } from '../../../ui/v2.js';
import { emoji } from '../../../ui/emoji.js';
import { LOG_CHANNELS } from '../../setup/lib/catalog.js';
import { logEmojiKey } from './palette.js';

export const LOGLAR_PAGE_SIZE = 12;
export const LOGSAY_PAGE_SIZE = 20;

export function totalPages(count, pageSize) {
  return Math.max(1, Math.ceil(count / pageSize));
}

function stateText(t, enabled) {
  return enabled ? t('loglar.state_on') : t('loglar.state_off');
}

function whenText(t, ts) {
  if (!ts) return t('loglar.never');
  return `<t:${Math.floor(ts / 1000)}:R>`;
}

/**
 * /loglar liste karti.
 * @param {{ page: number, ownerId: string, states: Map<string, {enabled: boolean, total: number, lastAt: number}> }} opts
 */
export function loglarListPayload(t, { page, ownerId, states }) {
  const pages = totalPages(LOG_CHANNELS.length, LOGLAR_PAGE_SIZE);
  const current = Math.min(Math.max(0, page), pages - 1);
  const slice = LOG_CHANNELS.slice(current * LOGLAR_PAGE_SIZE, (current + 1) * LOGLAR_PAGE_SIZE);

  const lines = slice.map((channel) => {
    const state = states.get(channel.key) ?? { enabled: true, total: 0, lastAt: 0 };
    const emojiText = emoji(logEmojiKey(channel.key)) || '';
    const prefix = emojiText ? `${emojiText} ` : '';
    return `${prefix}**${channel.name}** — ${stateText(t, state.enabled)} • ${whenText(t, state.lastAt)}`;
  });

  const options = slice.map((channel) => {
    const state = states.get(channel.key) ?? { enabled: true, total: 0, lastAt: 0 };
    return {
      label: channel.name,
      value: channel.key,
      emojiKey: logEmojiKey(channel.key),
      description: `${stateText(t, state.enabled)} • ${state.total} kayıt`,
    };
  });

  return infoTemplate(t('loglar.title'), lines, {
    buttons: [
      row([
        selectMenu({
          id: `loglar:sec:${current}:${ownerId}`,
          placeholder: t('loglar.select_placeholder'),
          options,
        }),
      ]),
      pageButtons({ namespace: 'loglar', page: current, totalPages: pages, ownerId }),
      row([
        button({
          id: `loglar:yenile:${current}:${ownerId}`,
          label: t('loglar.btn_refresh'),
          emojiKey: 'YENILE',
          style: 'secondary',
        }),
      ]),
    ],
    footer: footerLine([t('loglar.footer_page', { sayfa: current + 1, toplam: pages })]),
  });
}

/** /loglar detay karti (tek kanal + ac/kapat). */
export function logDetailPayload(t, { key, page, ownerId, state }) {
  const channel = LOG_CHANNELS.find((c) => c.key === key);
  if (!channel) {
    return errorTemplate(t('loglar.not_found_title'), [t('loglar.not_found_body')]);
  }

  const lines = [
    `${t('loglar.detail_state')}: **${stateText(t, state.enabled)}**`,
    `${t('loglar.detail_total')}: **${state.total}**`,
    `${t('loglar.detail_last')}: ${whenText(t, state.lastAt)}`,
    `${t('loglar.detail_key')}: \`${channel.key}\``,
  ];

  return infoTemplate(t('loglar.detail_title', { kanal: channel.name }), lines, {
    buttons: [
      row([
        button({
          id: `loglar:tgl:${key}:${page}:${ownerId}`,
          label: state.enabled ? t('loglar.btn_disable') : t('loglar.btn_enable'),
          emojiKey: state.enabled ? 'KILIT' : 'KILIT_ACIK',
          style: state.enabled ? 'danger' : 'success',
        }),
        button({
          id: `loglar:geri:${page}:${ownerId}`,
          label: t('loglar.btn_back'),
          emojiKey: 'OK_SOL',
          style: 'secondary',
        }),
      ]),
    ],
    footer: footerLine([channel.key]),
  });
}

/** /log-say karti. */
export function logsayPayload(t, { page, ownerId, rows }) {
  const pages = totalPages(rows.length, LOGSAY_PAGE_SIZE);
  const current = Math.min(Math.max(0, page), pages - 1);
  const slice = rows.slice(current * LOGSAY_PAGE_SIZE, (current + 1) * LOGSAY_PAGE_SIZE);
  const total = rows.reduce((sum, row) => sum + row.total, 0);

  const lines = slice.map((item) => {
    const emojiText = emoji(logEmojiKey(item.key)) || '';
    const prefix = emojiText ? `${emojiText} ` : '';
    return `${prefix}**${item.name}** — **${item.total}** • ${whenText(t, item.lastAt)}`;
  });

  return infoTemplate(t('logsay.title'), lines.length > 0 ? lines : [t('logsay.empty')], {
    buttons: [
      pageButtons({ namespace: 'logsay', page: current, totalPages: pages, ownerId }),
      row([
        button({
          id: `logsay:yenile:${current}:${ownerId}`,
          label: t('loglar.btn_refresh'),
          emojiKey: 'YENILE',
          style: 'secondary',
        }),
      ]),
    ],
    footer: footerLine([
      t('logsay.footer_total', { toplam: total }),
      t('loglar.footer_page', { sayfa: current + 1, toplam: pages }),
    ]),
  });
}

/** /log-sıfırla onay karti. */
export function logResetConfirmPayload(t, { ownerId, key = null }) {
  const scope = key
    ? t('logsifirla.scope_one', { kanal: LOG_CHANNELS.find((c) => c.key === key)?.name ?? key })
    : t('logsifirla.scope_all');
  return confirmTemplate({
    title: t('logsifirla.title'),
    description: [scope, t('logsifirla.warning')],
    confirmId: `logsifirla:onay:${ownerId}`,
    cancelId: `logsifirla:iptal:${ownerId}`,
    confirmLabel: t('logsifirla.confirm'),
    cancelLabel: t('logsifirla.cancel'),
    danger: true,
  });
}

/** /log-sıfırla sonuc karti. */
export function logResetDonePayload(t, { adet }) {
  return infoTemplate(t('logsifirla.done_title'), [t('logsifirla.done_body', { adet })]);
}
