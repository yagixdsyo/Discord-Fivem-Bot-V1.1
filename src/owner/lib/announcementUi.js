/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { panel } from '../../ui/templates/index.js';
import { row, button, footerLine } from '../../ui/v2.js';
import { shortId } from '../../core/announcements.js';

function formatDate(iso) {
  const ts = Math.floor(new Date(iso).getTime() / 1000);
  return Number.isFinite(ts) ? `<t:${ts}:R>` : '-';
}

/**
 * @param {{t: Function, kind: string, docs: object[], ownerId: string}} opts
 * @returns {object} V2 payload
 */
export function buildAnnouncementListCard({ t, kind, docs, ownerId }) {
  const kindLabel = t(`announce.kind_${kind}`);
  const buttons = [];
  const lines = [];

  for (const doc of docs) {
    const short = shortId(doc);
    const state = doc.visible ? t('announce.visible_on') : t('announce.visible_off');
    lines.push(`**\`${short}\`** — ${doc.title} — ${state} — ${formatDate(doc.created_at)}`);
    buttons.push(
      row([
        button({ id: `owner:duyuru:duzenle:${kind}:${short}:${ownerId}`, label: t('announce.btn_edit'), emojiKey: 'DUZENLE' }),
        button({
          id: `owner:duyuru:gorunurluk:${kind}:${short}:${doc.visible ? 'off' : 'on'}:${ownerId}`,
          label: doc.visible ? t('announce.btn_hide') : t('announce.btn_show'),
          emojiKey: doc.visible ? 'KILIT' : 'KILIT_ACIK',
        }),
        button({ id: `owner:duyuru:sil:${kind}:${short}:${ownerId}`, label: t('announce.btn_delete'), emojiKey: 'SIL', style: 'danger' }),
      ]),
    );
  }

  if (docs.length === 0) lines.push(t('owner.no_data'));

  return panel({
    emojiKey: 'DUYURU',
    title: t('announce.list_title', { tur: kindLabel }),
    sections: lines,
    buttons,
    footer: footerLine([t('announce.new_card_hint')]),
  });
}
