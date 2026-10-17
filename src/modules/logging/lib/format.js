/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { createTranslator } from '../../../locales/index.js';
import { getColor } from '../../../ui/colors.js';
import { V2_FLAG } from '../../../ui/limits.js';
import { brandFooter, container, footerLine, separator, text, titleLine } from '../../../ui/v2.js';
import { emoji } from '../../../ui/emoji.js';
import { logAccent, logEmojiKey } from './palette.js';

const t = createTranslator('tr');
const SNOWFLAKE_RE = /^\d{15,25}$/;

function truncate(value, limit) {
  const str = String(value ?? '');
  if (str.length <= limit) return str;
  return `${str.slice(0, Math.max(0, limit - 3))}...`;
}

function renderId(id, tag) {
  if (id === null || id === undefined) return null;
  const base = SNOWFLAKE_RE.test(String(id)) ? `<@${id}>` : String(id);
  return tag ? `${base} (${tag})` : base;
}

/** Tek kaydin satir listesi. */
export function entryLines(entry = {}) {
  const nowSec = Math.floor((entry.at ?? Date.now()) / 1000);
  const lines = [];

  const actor = renderId(entry.actor, entry.actorTag);
  if (actor) lines.push(`${t('log.fields.actor')}: ${actor}`);
  const target = renderId(entry.target, entry.targetTag);
  if (target) lines.push(`${t('log.fields.target')}: ${target}`);

  lines.push(`${t('log.fields.time')}: <t:${nowSec}:F> (<t:${nowSec}:R>)`);
  if (entry.reason) lines.push(`${t('log.fields.reason')}: ${truncate(entry.reason, 300)}`);

  for (const line of entry.lines ?? []) {
    if (line) lines.push(truncate(line, 500));
  }
  for (const [label, id] of entry.ids ?? []) {
    lines.push(`**${label}:** \`${id}\``);
  }
  return lines;
}

function entryTitle(key, entry) {
  return entry?.title ?? t(`log.titles.${key}`);
}

/** Tek log kaydi payload'i. */
export function singleLogPayload({ key, entry, guildName }) {
  const emojiKey = logEmojiKey(key);
  const children = [text(titleLine(emojiKey, entryTitle(key, entry)))];

  const lines = entryLines(entry);
  if (lines.length > 0) {
    children.push(separator());
    children.push(text(lines.join('\n')));
  }

  children.push(text(brandFooter(footerLine([guildName, key]))));

  const result = {
    components: [
      container(children, { accentColor: getColor(entry?.accent ?? logAccent(key)) }),
    ],
    flags: V2_FLAG,
    allowedMentions: { parse: [] },
  };
  if (entry?.files?.length) result.files = entry.files;
  return result;
}

/** Toplu gonderim icin kisa tek satirlik ozet. */
function compactLine(entry = {}) {
  const parts = [];
  const actor = renderId(entry.actor, entry.actorTag);
  if (actor) parts.push(actor);
  const target = renderId(entry.target, entry.targetTag);
  if (target) parts.push(`-> ${target}`);
  if (entry.reason) parts.push(truncate(entry.reason, 60));
  if (parts.length === 0 && entry.lines?.length) parts.push(truncate(entry.lines[0], 120));
  return parts.join(' ');
}

/** Birden fazla kaydi tek V2 mesajinda birlestirir (batch). */
export function batchLogPayload({ items, guildName }) {
  const children = [
    text(titleLine('BELGE', t('log.batch.title', { adet: items.length }))),
  ];

  for (const item of items) {
    children.push(separator());
    const emojiText = emoji(logEmojiKey(item.key)) || '';
    const header = `${emojiText ? `${emojiText} ` : ''}**${entryTitle(item.key, item.entry)}**`;
    const detail = compactLine(item.entry);
    const time = `<t:${Math.floor((item.entry?.at ?? item.at ?? Date.now()) / 1000)}:t>`;
    children.push(text(detail ? `${header} ${time}\n-# ${detail}` : `${header} ${time}`));
  }

  children.push(text(brandFooter(footerLine([guildName, t('log.batch.footer')]))));

  const firstWithFiles = items.find((item) => item.entry?.files?.length);
  const result = {
    components: [container(children, { accentColor: getColor('info') })],
    flags: V2_FLAG,
    allowedMentions: { parse: [] },
  };
  if (firstWithFiles) result.files = firstWithFiles.entry.files;
  return result;
}
