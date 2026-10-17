/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getLatestAnnouncement } from '../../../core/announcements.js';
import { info, panel } from '../../../ui/templates/index.js';
import { footerLine } from '../../../ui/v2.js';

const EMOJI_BY_KIND = {
  guncelleme: 'YENILE',
  yenilik: 'YILDIZ',
  bakim: 'DURUM_BAKIM',
};

/**
 * Acik olan son duyuruyu V2 karti olarak dondurur.
 * Yoksa "yayinda duyuru yok" kartina doner.
 */
export async function buildAnnouncementView(ctx, kind) {
  const t = ctx.t;
  const ann = await getLatestAnnouncement(kind, { visibleOnly: true });

  if (!ann) {
    return info(t('announce.none_title'), [t('announce.none_body')]);
  }

  const kindLabel = t(`announce.kind_${kind}`);
  const ts = Math.floor(new Date(ann.created_at ?? Date.now()).getTime() / 1000);
  const footerParts = [kindLabel];
  if (ann.version) footerParts.push(`v${ann.version}`);
  footerParts.push(`<t:${ts}:d>`);

  const bodyLines = String(ann.body ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return panel({
    emojiKey: EMOJI_BY_KIND[kind] ?? 'DUYURU',
    title: ann.title,
    subtitle: kindLabel,
    sections: bodyLines,
    footer: footerLine(footerParts),
  });
}
