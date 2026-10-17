/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { card } from '../../../ui/templates/base.js';
import { kv, list } from '../../../ui/templates/index.js';
import { button, row } from '../../../ui/v2.js';
import { renderServerCardPng } from '../../../ui/canvas/server.js';
import { getColor } from '../../../ui/colors.js';
import { STATUS_STYLE } from './statusPanel.js';

function sec(iso) {
  const ms = Date.parse(iso ?? '');
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

// ---------------------------------------------------------------------------
// Kayit (15.2)
// ---------------------------------------------------------------------------

/** Kayit durum paneli (/kayit-aktif, /kayit-kapali). */
export function kayitPanelPayload(t, { open = true, actorTag = null, at = null }) {
  const lines = [
    t('fivem.kayit.panel_status', { durum: open ? t('fivem.kayit.open') : t('fivem.kayit.closed') }),
    t('fivem.kayit.panel_hint'),
  ];
  if (actorTag) lines.push(t('fivem.kayit.panel_updated', { kisi: actorTag, zaman: sec(at) ? `<t:${sec(at)}:R>` : '-' }));

  return card({
    emojiKey: open ? 'KAYIT_ACIK' : 'KAYIT_KAPALI',
    title: t('fivem.kayit.panel_title'),
    lines,
    accent: open ? 'success' : 'error',
    footer: t('fivem.kayit.panel_footer'),
  });
}

/** Kayit sonucu bildirimi. */
export function kayitResultPayload(t, { userId, icName, oocName = null, actorId = null }) {
  const lines = [t('fivem.kayit.done_line', { kullanici: `<@${userId}>`, isim: `**${icName}**` })];
  if (oocName) lines.push(t('fivem.kayit.ooc_line', { isim: oocName }));
  if (actorId) lines.push(t('fivem.kayit.by_line', { yetkili: `<@${actorId}>` }));

  return card({
    emojiKey: 'KAYIT',
    title: t('fivem.kayit.done_title'),
    lines,
    accent: 'success',
  });
}

/** Yetkili kayit sayaci (/kayit-log). */
export function kayitLogPayload(t, { items, page, ownerId, pageSize = 10 }) {
  return list({
    emojiKey: 'KAYIT',
    title: t('fivem.kayit.log_title'),
    items,
    page,
    pageSize,
    namespace: 'kayitlog',
    ownerId,
    emptyText: t('fivem.kayit.log_empty'),
    renderItem: (rowItem) =>
      t('fivem.kayit.log_count_line', {
        yetkili: `<@${rowItem.actor_id}>`,
        adet: `**${rowItem.adet}**`,
      }),
  });
}

/** Kullanici kayit gecmisi (/kayit-gecmis). */
export function kayitHistoryPayload(t, { userId, items, page, ownerId, pageSize = 8 }) {
  return list({
    emojiKey: 'KAYIT',
    title: t('fivem.kayit.history_title', { kullanici: `<@${userId}>` }),
    items,
    page,
    pageSize,
    namespace: 'kayitgecmis',
    ownerId,
    emptyText: t('fivem.kayit.history_empty'),
    renderItem: (doc) =>
      t('fivem.kayit.history_line', {
        isim: `**${doc.ic_name}**`,
        yetkili: `<@${doc.actor_id}>`,
        tarih: sec(doc.created_at) ? `<t:${sec(doc.created_at)}:R>` : '-',
      }),
  });
}

// ---------------------------------------------------------------------------
// Whitelist / isim (15.3)
// ---------------------------------------------------------------------------

export function whitelistPayload(t, { action, userId, isim = null, actorId = null }) {
  const ver = action === 'ver';
  const lines = [
    t(ver ? 'fivem.wh.given_line' : 'fivem.wh.removed_line', { kullanici: `<@${userId}>` }),
  ];
  if (ver && isim) lines.push(t('fivem.wh.name_line', { isim: `**${isim}**` }));
  if (actorId) lines.push(t('fivem.wh.by_line', { yetkili: `<@${actorId}>` }));

  return card({
    emojiKey: 'WHITELIST',
    title: t(ver ? 'fivem.wh.given_title' : 'fivem.wh.removed_title'),
    lines,
    accent: ver ? 'success' : 'warn',
  });
}

/** IC/OOC isim onay karti (butonlu). */
export function nameRequestPayload(t, { doc, ownerId }) {
  const rows = [
    [t('fivem.name.user'), `<@${doc.user_id}> \`${doc.user_id}\``],
    [t('fivem.name.kind'), doc.kind === 'ic' ? t('fivem.name.ic') : t('fivem.name.ooc')],
    [t('fivem.name.new_name'), `**${doc.name}**`],
    [t('fivem.name.date'), sec(doc.created_at) ? `<t:${sec(doc.created_at)}:R>` : '-'],
  ];
  const buttons = [
    row([
      button({ id: `icisim:onay:${doc.request_id}:${ownerId}`, label: t('fivem.name.approve'), emojiKey: 'ONAY', style: 'success' }),
      button({ id: `icisim:red:${doc.request_id}:${ownerId}`, label: t('fivem.name.reject'), emojiKey: 'RED', style: 'danger' }),
    ]),
  ];

  return kv({ title: t('fivem.name.title'), emojiKey: 'IC_ISIM', accent: 'info', rows, buttons, footer: `\`${doc.request_id}\`` });
}

// ---------------------------------------------------------------------------
// Olusum (15.4)
// ---------------------------------------------------------------------------

export function olusumInfoPayload(t, { doc, memberCount = null, roleName = null }) {
  const rows = [
    [t('fivem.olusum.name'), `**${doc.name}**`],
    [t('fivem.olusum.role'), roleName ? `@${roleName}` : `<@&${doc.role_id}>`],
    [t('fivem.olusum.owner'), doc.owner_id ? `<@${doc.owner_id}>` : t('common.none')],
    [t('fivem.olusum.status'), doc.active ? t('fivem.olusum.active') : t('fivem.olusum.closed')],
  ];
  if (doc.limit) rows.push([t('fivem.olusum.limit'), `**${doc.limit}**`]);
  if (memberCount !== null) rows.push([t('fivem.olusum.members'), `**${memberCount}**`]);
  rows.push([t('fivem.olusum.date'), sec(doc.created_at) ? `<t:${sec(doc.created_at)}:R>` : '-']);

  return kv({ title: t('fivem.olusum.info_title'), emojiKey: 'OLUSUM', accent: 'primary', rows, footer: `\`${doc.olusum_id}\`` });
}

export function olusumListPayload(t, { items, page, ownerId, pageSize = 10 }) {
  return list({
    emojiKey: 'OLUSUM',
    title: t('fivem.olusum.list_title'),
    items,
    page,
    pageSize,
    namespace: 'olusumliste',
    ownerId,
    emptyText: t('fivem.olusum.list_empty'),
    renderItem: (doc) =>
      t('fivem.olusum.list_line', {
        ad: `**${doc.name}**`,
        rol: `<@&${doc.role_id}>`,
        durum: doc.active ? t('fivem.olusum.active') : t('fivem.olusum.closed'),
      }),
  });
}

/** Perm talebi karti. */
export function olusumPermCardPayload(t, { doc, ownerId }) {
  const rows = [
    [t('fivem.olusum.perm_olusum'), `**${doc.name}**`],
    [t('fivem.olusum.perm_user'), `<@${doc.user_id}>`],
    [t('fivem.olusum.perm_role'), doc.role_name ? `@${doc.role_name}` : t('common.none')],
    [t('fivem.olusum.perm_note'), doc.note ?? t('common.none')],
  ];
  const buttons = [
    row([
      button({ id: `olusumper:onay:${doc.perm_id}:${ownerId}`, label: t('fivem.olusum.perm_approve'), emojiKey: 'ONAY', style: 'success' }),
      button({ id: `olusumper:red:${doc.perm_id}:${ownerId}`, label: t('fivem.olusum.perm_reject'), emojiKey: 'RED', style: 'danger' }),
    ]),
  ];
  return kv({ title: t('fivem.olusum.perm_title'), emojiKey: 'OLUSUM', accent: 'warn', rows, buttons, footer: `\`${doc.perm_id}\`` });
}

// ---------------------------------------------------------------------------
// Destek (15.5)
// ---------------------------------------------------------------------------

/** Yetkili cagirma / bekleme bildirimi (tek seferlik). */
export function supportCallPayload(t, { userId, ownerId = null, kind = 'cagri' }) {
  const lines = [
    t(kind === 'bekleme' ? 'fivem.destek.call_wait_line' : 'fivem.destek.call_line', { kullanici: `<@${userId}>` }),
    t('fivem.destek.call_hint'),
  ];
  const buttons = [
    row([
      button({ id: `destek:sahiplen:${userId}`, label: t('fivem.destek.claim'), emojiKey: 'KULLANICI', style: 'success' }),
      button({ id: `destek:cek:${userId}`, label: t('fivem.destek.pull'), emojiKey: 'SES', style: 'primary' }),
      button({ id: `destek:kapat:${userId}`, label: t('fivem.destek.close'), emojiKey: 'RED', style: 'secondary' }),
    ]),
  ];
  return card({
    emojiKey: 'DESTEK',
    title: t('fivem.destek.call_title'),
    lines,
    accent: 'warn',
    buttons,
    footer: ownerId ? `\`${ownerId}\`` : null,
  });
}

/** Destek cagri paneli ("Yetkili Cagir" butonu). */
export function supportPanelPayload(t) {
  return card({
    emojiKey: 'DESTEK',
    title: t('fivem.destek.panel_title'),
    lines: [t('fivem.destek.panel_line'), t('fivem.destek.panel_hint')],
    accent: 'info',
    buttons: [row([button({ id: 'destek:cagir', label: t('fivem.destek.panel_button'), emojiKey: 'ZIL', style: 'primary' })])],
  });
}

export function supportRecordListPayload(t, { items, page, ownerId, pageSize = 8, titleKey = 'fivem.destek.rec_list_title' }) {
  return list({
    emojiKey: 'DESTEK',
    title: t(titleKey),
    items,
    page,
    pageSize,
    namespace: 'destekkayit',
    ownerId,
    emptyText: t('fivem.destek.rec_empty'),
    renderItem: (doc) =>
      t('fivem.destek.rec_line', {
        yetkili: `<@${doc.actor_id}>`,
        kullanici: `<@${doc.user_id}>`,
        tur: t(`fivem.destek.kind.${doc.kind}`),
        dakika: `**${doc.minutes}**`,
        tarih: sec(doc.created_at) ? `<t:${sec(doc.created_at)}:R>` : '-',
      }),
  });
}

export function supportStatsPayload(t, { rows, days = 30 }) {
  return list({
    emojiKey: 'GRAFIK',
    title: t('fivem.destek.stats_title', { gun: days }),
    items: rows,
    page: 0,
    pageSize: rows.length || 1,
    namespace: 'destekstats',
    ownerId: null,
    emptyText: t('fivem.destek.rec_empty'),
    renderItem: (rowItem) =>
      t('fivem.destek.stats_line', {
        yetkili: `<@${rowItem.actor_id}>`,
        adet: `**${rowItem.adet}**`,
        dakika: `**${rowItem.dakika}**`,
      }),
  });
}

// ---------------------------------------------------------------------------
// Mulakat (15.6)
// ---------------------------------------------------------------------------

export function interviewCardPayload(t, { doc, ownerId }) {
  const rows = [
    [t('fivem.mulakat.user'), `<@${doc.user_id}> \`${doc.user_id}\``],
    [t('fivem.mulakat.invited_by'), `<@${doc.invited_by}>`],
    [t('fivem.mulakat.status'), t(`fivem.mulakat.status_label.${doc.status}`)],
    [t('fivem.mulakat.date'), sec(doc.created_at) ? `<t:${sec(doc.created_at)}:R>` : '-'],
  ];
  const buttons = [
    row([
      button({ id: `mulakat:gecti:${doc.interview_id}:${ownerId}`, label: t('fivem.mulakat.pass'), emojiKey: 'ONAY', style: 'success' }),
      button({ id: `mulakat:kaldi:${doc.interview_id}:${ownerId}`, label: t('fivem.mulakat.fail'), emojiKey: 'RED', style: 'danger' }),
      button({ id: `mulakat:ertele:${doc.interview_id}:${ownerId}`, label: t('fivem.mulakat.postpone'), emojiKey: 'SAAT', style: 'secondary' }),
    ]),
  ];
  return kv({ title: t('fivem.mulakat.card_title'), emojiKey: 'MULAKAT', accent: 'info', rows, buttons, footer: `\`${doc.interview_id}\`` });
}

export function interviewListPayload(t, { items, page, ownerId, pageSize = 8 }) {
  return list({
    emojiKey: 'MULAKAT',
    title: t('fivem.mulakat.list_title'),
    items,
    page,
    pageSize,
    namespace: 'mulakatliste',
    ownerId,
    emptyText: t('fivem.mulakat.list_empty'),
    renderItem: (doc) =>
      t('fivem.mulakat.list_line', {
        kullanici: `<@${doc.user_id}>`,
        durum: t(`fivem.mulakat.status_label.${doc.status}`),
        davet: sec(doc.created_at) ? `<t:${sec(doc.created_at)}:R>` : '-',
      }),
  });
}

/** DM on soru-cevap ozeti (yetkili kanalina dusen kart). */
export function dmAnswersPayload(t, { doc, answers }) {
  const lines = [
    t('fivem.mulakat.dm_answers_user', { kullanici: `<@${doc.user_id}> \`${doc.user_id}\`` }),
  ];
  for (let i = 0; i < answers.length; i += 1) {
    lines.push(t('fivem.mulakat.dm_answers_item', { sira: i + 1, soru: answers[i].soru }));
    lines.push(`> ${String(answers[i].cevap).replace(/\n/g, ' ').slice(0, 300)}`);
  }
  return card({
    emojiKey: 'MULAKAT',
    title: t('fivem.mulakat.dm_answers_title'),
    lines,
    accent: 'info',
    footer: `\`${doc.interview_id}\``,
  });
}

// ---------------------------------------------------------------------------
// Ekip (15.4)
// ---------------------------------------------------------------------------

export function ekipInfoPayload(t, { team, memberCount = null }) {
  const rows = [
    [t('fivem.ekip.name'), `**${team.name}**`],
    [t('fivem.ekip.type'), t(`fivem.ekip.types.${team.type}`)],
    [t('fivem.ekip.role'), `<@&${team.role_id}>`],
    [t('fivem.ekip.patron'), team.patron_id ? `<@${team.patron_id}>` : t('common.none')],
    [t('fivem.ekip.boss'), (team.boss_ids ?? []).length ? team.boss_ids.map((id) => `<@${id}>`).join(', ') : t('common.none')],
  ];
  if (team.limit) rows.push([t('fivem.ekip.limit'), `**${team.limit}**`]);
  if (memberCount !== null) rows.push([t('fivem.ekip.members'), `**${memberCount}**`]);
  rows.push([t('fivem.ekip.lock'), team.writing_locked ? t('fivem.ekip.locked') : t('fivem.ekip.unlocked')]);

  return kv({ title: t('fivem.ekip.info_title'), emojiKey: 'EKIP', accent: 'primary', rows, footer: `\`${team.team_id}\`` });
}

export function ekipListPayload(t, { items, page, ownerId, pageSize = 10 }) {
  return list({
    emojiKey: 'EKIP',
    title: t('fivem.ekip.list_title'),
    items,
    page,
    pageSize,
    namespace: 'ekipliste',
    ownerId,
    emptyText: t('fivem.ekip.list_empty'),
    renderItem: (team) =>
      t('fivem.ekip.list_line', {
        ad: `**${team.name}**`,
        tur: t(`fivem.ekip.types.${team.type}`),
        tarih: sec(team.created_at) ? `<t:${sec(team.created_at)}:R>` : '-',
      }),
  });
}

// ---------------------------------------------------------------------------
// Donate (15.10)
// ---------------------------------------------------------------------------

export function donateInfoPayload(t, { info }) {
  const lines = [info.intro ?? ''];
  for (const paket of info.packages ?? []) {
    lines.push(t('fivem.donate.package_line', { ad: `**${paket.name}**`, fiyat: paket.price ?? '-', aciklama: paket.desc ?? '' }));
  }
  if (info.methods?.length) lines.push(t('fivem.donate.methods_line', { yontemler: info.methods.join(', ') }));
  if (info.contact) lines.push(t('fivem.donate.contact_line', { iletisim: info.contact }));

  return card({ emojiKey: 'DONATE', title: t('fivem.donate.info_title'), lines, accent: 'success' });
}

export function donateListPayload(t, { items, page, ownerId, pageSize = 8 }) {
  return list({
    emojiKey: 'DONATE',
    title: t('fivem.donate.list_title'),
    items,
    page,
    pageSize,
    namespace: 'donatelist',
    ownerId,
    emptyText: t('fivem.donate.list_empty'),
    renderItem: (doc) =>
      t('fivem.donate.list_line', {
        kullanici: `<@${doc.user_id}>`,
        paket: `**${doc.package}**`,
        tutar: doc.amount ?? '-',
        kod: `\`${doc.donate_id}\``,
        yetkili: doc.actor_id ? `<@${doc.actor_id}>` : t('common.unknown'),
        tarih: sec(doc.created_at) ? `<t:${sec(doc.created_at)}:R>` : '-',
      }),
  });
}

// ---------------------------------------------------------------------------
// Sikayet / feedback (15.11)
// ---------------------------------------------------------------------------

export function complaintPanelPayload(t) {
  return card({
    emojiKey: 'SIKAYET',
    title: t('fivem.sikayet.panel_title'),
    lines: [t('fivem.sikayet.panel_line'), t('fivem.sikayet.panel_hint')],
    accent: 'info',
    buttons: [row([button({ id: 'sikayet:ac', label: t('fivem.sikayet.panel_button'), emojiKey: 'NOT', style: 'primary' })])],
  });
}

export function complaintCardPayload(t, { doc, ownerId }) {
  const rows = [
    [t('fivem.sikayet.user'), `<@${doc.user_id}> \`${doc.user_id}\``],
    [t('fivem.sikayet.target'), doc.target],
    [t('fivem.sikayet.reason'), doc.reason],
    [t('fivem.sikayet.evidence'), doc.evidence ?? t('common.none')],
    [t('fivem.sikayet.status'), t(`fivem.sikayet.status_label.${doc.status}`)],
    [t('fivem.sikayet.date'), sec(doc.created_at) ? `<t:${sec(doc.created_at)}:R>` : '-'],
  ];
  const buttons = [
    row([
      button({ id: `sikayet:inceleniyor:${doc.complaint_id}:${ownerId}`, label: t('fivem.sikayet.reviewing'), emojiKey: 'ARAMA', style: 'primary' }),
      button({ id: `sikayet:sonuclandi:${doc.complaint_id}:${ownerId}`, label: t('fivem.sikayet.done'), emojiKey: 'ONAY', style: 'success' }),
      button({ id: `sikayet:reddedildi:${doc.complaint_id}:${ownerId}`, label: t('fivem.sikayet.reject'), emojiKey: 'RED', style: 'danger' }),
    ]),
  ];
  return kv({ title: t('fivem.sikayet.card_title'), emojiKey: 'SIKAYET', accent: 'warn', rows, buttons, footer: `\`${doc.complaint_id}\`` });
}

// ---------------------------------------------------------------------------
// Kurallar / oylama (15.14)
// ---------------------------------------------------------------------------

export function rulesPayload(t, { pages, index = 0, selectRow = null }) {
  const page = pages[index];
  const lines = [...(page?.lines ?? [])];

  return card({
    emojiKey: 'BELGE',
    title: page?.title ?? t('fivem.rules.title'),
    lines,
    accent: 'info',
    buttons: selectRow ? [selectRow] : [],
    footer: t('fivem.rules.footer', { sayfa: `${index + 1}/${pages.length}` }),
  });
}

export function pollPayload(t, { doc, results, closed = false, ownerId = null }) {
  const lines = [];
  for (const result of results) {
    lines.push(t('fivem.poll.line', { secenek: result.text, sayi: `**${result.count}**`, yuzde: `%${result.percent}`, cubuk: result.bar }));
  }
  lines.push(t('fivem.poll.total_votes', { toplam: `**${results.reduce((acc, r) => acc + r.count, 0)}**` }));
  if (doc.ends_at) lines.push(t('fivem.poll.ends', { zaman: sec(doc.ends_at) ? `<t:${sec(doc.ends_at)}:R>` : '-' }));

  const buttons = [];
  if (!closed && ownerId) {
    buttons.push(row([button({ id: `oylama:kapat:${doc.poll_id}:${ownerId}`, label: t('fivem.poll.close'), emojiKey: 'KILIT', style: 'secondary' })]));
  }

  return card({
    emojiKey: 'GRAFIK',
    title: doc.question,
    lines,
    accent: closed ? 'info' : 'primary',
    buttons,
    footer: closed ? t('fivem.poll.closed') : t('fivem.poll.hint'),
  });
}

// ---------------------------------------------------------------------------
// Sunucu bilgi (15.1)
// ---------------------------------------------------------------------------

/** Durum degisikligi onay karti (/aktif, /bakım, /restart, /kapalı, /sunucu-durum). */
export function statusChangePayload(t, { state, until = null, note = null, lines = [] } = {}) {
  const style = STATUS_STYLE[state] ?? STATUS_STYLE.aktif;
  const body = [t('fivem.status.set_line', { durum: t(`fivem.status.state.${state}`) })];
  const untilSec = sec(until);
  if (untilSec) body.push(t('fivem.status.until', { zaman: `<t:${untilSec}:F>`, kalan: `<t:${untilSec}:R>` }));
  if (note) body.push(t('fivem.status.note', { not: note }));
  for (const line of lines) if (line) body.push(line);

  return card({
    emojiKey: style.emoji,
    title: t('fivem.status.set_title'),
    lines: body,
    accent: style.accent,
  });
}

/**
 * Sunucu bilgi karti (/sunucu-bilgi-fivem): canvas sunucu karti + V2 kart;
 * canvas uretilemezse kv kartina duser.
 */
export async function serverInfoPayload(t, { guild, cfx, info, ip = null, rulesChannel = null, rulesChannelName = null, trackedOnline = null }) {
  const title = t('fivem.info.title', { sunucu: guild?.name ?? '' });
  const rows = [
    [t('fivem.info.name'), info?.ok && info.name ? `**${info.name}**` : (guild?.name ?? '-')],
    [t('fivem.info.ip'), ip ? `\`${ip}\`` : t('common.none')],
    [t('fivem.info.cfx'), cfx?.code ? `\`${cfx.code}\` — ${t('fivem.status.quick_join')}` : t('common.none')],
  ];
  if (info?.ok) rows.push([t('fivem.info.players'), `**${info.players}** / ${info.maxPlayers}`]);
  else if (cfx?.code) rows.push([t('fivem.info.status'), t('fivem.info.offline')]);
  if (Number.isFinite(trackedOnline)) rows.push([t('fivem.info.tracked'), `**${trackedOnline}**`]);
  if (rulesChannel) rows.push([t('fivem.info.rules'), `<#${rulesChannel}>`]);
  rows.push([t('fivem.info.wh_steps'), t('fivem.info.wh_steps_text')]);

  const online = info?.ok ? { current: info.players, max: info.maxPlayers } : null;
  const statusText = online
    ? t('fivem.info.online_label')
    : (cfx?.code ? t('fivem.info.offline_label') : null);

  const chips = [];
  if (cfx?.code) chips.push({ label: t('fivem.info.cfx'), value: cfx.code });
  if (Number.isFinite(trackedOnline)) chips.push({ label: t('fivem.info.tracked'), value: String(trackedOnline) });
  if (rulesChannel && rulesChannelName) chips.push({ label: t('fivem.info.rules'), value: `#${rulesChannelName}` });

  const fileName = `sunucu-bilgi-${guild?.id ?? 'fivem'}.png`;
  const png = await renderServerCardPng({
    title,
    subtitle: ip ? `${t('fivem.info.ip')}: ${ip}` : null,
    statusText,
    statusColor: getColor(online ? 'success' : 'error'),
    online,
    playersLabel: t('fivem.info.players'),
    chips,
    accent: getColor('primary'),
  });

  if (png) {
    return card({
      emojiKey: 'FIVEM',
      title,
      lines: [t('fivem.info.wh_steps_text')],
      accent: online ? 'success' : 'primary',
      imageUrls: [`attachment://${fileName}`],
      files: [new AttachmentBuilder(png, { name: fileName })],
    });
  }

  return kv({ title, emojiKey: 'FIVEM', accent: 'primary', rows });
}
