/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  container,
  payload as makePayload,
  text,
  separator,
  section,
  titleLine,
  row,
  gallery,
  withDisabledButtons,
  brandFooter,
} from '../v2.js';
import { getColor } from '../colors.js';

/**
 * @param {{
 *   emojiKey?: string,
 *   title?: string,
 *   subtitle?: string,
 *   lines?: string[],
 *   sections?: Array<string | {text: string, accessory?: import('discord.js').ButtonBuilder} | {separator: true}>,
 *   accent?: 'primary'|'success'|'error'|'warn'|'info',
 *   accentColor?: number,
 *   buttons?: Array<import('discord.js').ActionRowBuilder | unknown[]>,
 *   imageUrls?: string[],
 *   footer?: string,
 *   fileComponents?: unknown[],
 *   files?: unknown[],
 *   ephemeral?: boolean,
 * }} opts
 */
export function card(opts) {
  const {
    emojiKey,
    title,
    subtitle,
    lines = [],
    sections,
    accent = 'info',
    accentColor,
    buttons = [],
    imageUrls = [],
    footer,
    fileComponents = [],
    files,
    ephemeral = false,
  } = opts;

  const children = [];

  if (title) children.push(text(titleLine(emojiKey, title)));
  if (subtitle) children.push(text(`-# ${subtitle}`));

  const bodyLines = (lines ?? []).filter(Boolean);
  const hasBody = bodyLines.length > 0 || (sections && sections.length > 0);
  if (title && hasBody) children.push(separator());

  if (bodyLines.length > 0) {
    children.push(text(bodyLines.join('\n')));
  }

  if (sections && sections.length > 0) {
    for (const entry of sections) {
      if (entry && typeof entry === 'object' && entry.separator) {
        children.push(separator({ divider: true, spacing: 'small' }));
        continue;
      }
      if (typeof entry === 'string') {
        children.push(text(entry));
        continue;
      }
      if (entry && typeof entry === 'object') {
        if (entry.accessory) {
          children.push(section(entry.text, { accessory: entry.accessory }));
        } else {
          // Discord'da Section accessory'siz olamaz; accessory verilmediyse duz metin eklenir.
          children.push(text(entry.text));
        }
      }
    }
  }

  for (const btn of buttons) {
    children.push(Array.isArray(btn) ? row(btn) : btn);
  }

  if (imageUrls.length > 0) {
    children.push(gallery(imageUrls));
  }

  // Alt bilgi her kartta bulunur ve marka imzasini tasir.
  children.push(text(brandFooter(footer)));

  for (const fileComponent of fileComponents) {
    children.push(fileComponent);
  }

  return makePayload({
    components: [container(children, { accentColor: accentColor ?? getColor(accent) })],
    ephemeral,
    files,
  });
}

/** Butun butonlari devre disi birakilmis kopya payload (collector bitince). */
export function disabledCard(payloadLike) {
  const result = {
    components: withDisabledButtons(payloadLike),
    flags: payloadLike.flags,
    allowedMentions: { parse: [] },
  };
  if (payloadLike.files) result.files = payloadLike.files;
  return result;
}
