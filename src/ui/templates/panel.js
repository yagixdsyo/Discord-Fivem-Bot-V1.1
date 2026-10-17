/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from './base.js';

/**
 * Genel panel/sayfa karti.
 * sections: string | {text, accessory?: ButtonBuilder} | {separator: true}
 * buttons: satir dizileri veya hazir ActionRowBuilder'lar
 */
export function panel({ title, description, sections, buttons = [], accentColor, accent = 'primary', footer, emojiKey, fileComponents, files, subtitle, ephemeral }) {
  const lines = Array.isArray(description) ? description : description ? [description] : [];
  return card({
    emojiKey,
    title,
    subtitle,
    lines,
    sections,
    buttons,
    accent,
    accentColor,
    footer,
    fileComponents,
    files,
    ephemeral,
  });
}
