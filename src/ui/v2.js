/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  FileBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';
import { V2_FLAG } from './limits.js';
import { getColor } from './colors.js';
import { emojiObj, emoji } from './emoji.js';

// ---------------------------------------------------------------------------
// Temel bilesenler
// ---------------------------------------------------------------------------

export function text(content) {
  return new TextDisplayBuilder({ content });
}

export function separator({ divider = true, spacing = 'small' } = {}) {
  return new SeparatorBuilder({
    divider,
    spacing: spacing === 'large' ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small,
  });
}

export function container(children = [], { accentColor, spoiler } = {}) {
  const builder = new ContainerBuilder();
  if (accentColor !== undefined) builder.setAccentColor(accentColor);
  if (spoiler !== undefined) builder.setSpoiler(spoiler);

  for (const child of children.filter(Boolean)) {
    if (child instanceof ActionRowBuilder) builder.addActionRowComponents(child);
    else if (child instanceof TextDisplayBuilder) builder.addTextDisplayComponents(child);
    else if (child instanceof SeparatorBuilder) builder.addSeparatorComponents(child);
    else if (child instanceof SectionBuilder) builder.addSectionComponents(child);
    else if (child instanceof MediaGalleryBuilder) builder.addMediaGalleryComponents(child);
    else if (child instanceof FileBuilder) builder.addFileComponents(child);
    else throw new Error(`container(): desteklenmeyen bilesen: ${child?.constructor?.name}`);
  }
  return builder;
}

export function section(texts, { accessory } = {}) {
  if (!accessory) {
    // Discord Section bileseni accessory (Button veya Thumbnail) olmadan gonderilemez.
    throw new Error('section(): accessory (Button veya Thumbnail) zorunlu');
  }
  const builder = new SectionBuilder();
  builder.addTextDisplayComponents(
    ...(Array.isArray(texts) ? texts : [texts]).map((t) => (typeof t === 'string' ? text(t) : t)),
  );
  if (accessory) {
    if (accessory instanceof ButtonBuilder) builder.setButtonAccessory(accessory);
    else if (accessory instanceof ThumbnailBuilder) builder.setThumbnailAccessory(accessory);
    else throw new Error('section(): accessory Button veya Thumbnail olmali');
  }
  return builder;
}

export function thumbnail(url) {
  return new ThumbnailBuilder({ media: { url } });
}

export function gallery(urls, { spoiler } = {}) {
  const builder = new MediaGalleryBuilder();
  builder.addItems(
    urls.map((url) => new MediaGalleryItemBuilder({ media: { url } }).setSpoiler(Boolean(spoiler))),
  );
  return builder;
}

export function file(attachmentUrl, { spoiler } = {}) {
  const builder = new FileBuilder({ file: { url: attachmentUrl } });
  if (spoiler) builder.setSpoiler(true);
  return builder;
}

export function row(components) {
  return new ActionRowBuilder().addComponents(...components);
}

/**
 * Buton yardimcisi: emoji anahtari ve stil kolayligi.
 * customId formati: 'modul:aksiyon:param' (<= 100 karakter).
 */
export function button({ id, label, style = 'secondary', emojiKey, disabled = false, url } = {}) {
  const builder = new ButtonBuilder();
  if (url) {
    builder.setURL(url).setStyle(ButtonStyle.Link);
  } else {
    if (!id) throw new Error('button(): link degilse id zorunlu');
    builder.setCustomId(id).setStyle(styleToEnum(style));
  }
  if (label) builder.setLabel(label);
  const e = emojiKey ? emojiObj(emojiKey) : undefined;
  if (e) builder.setEmoji(e);
  if (disabled) builder.setDisabled(true);
  return builder;
}

function styleToEnum(style) {
  const map = {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger,
    link: ButtonStyle.Link,
  };
  const value = map[String(style).toLowerCase()];
  if (!value) throw new Error(`button(): bilinmeyen stil: ${style}`);
  return value;
}

export function selectMenu({ id, placeholder, options, min = 1, max = 1, disabled = false }) {
  const builder = new StringSelectMenuBuilder()
    .setCustomId(id)
    .setPlaceholder(placeholder)
    .setMinValues(min)
    .setMaxValues(max)
    .setDisabled(disabled);
  builder.addOptions(
    options.map((opt) => {
      const option = new StringSelectMenuOptionBuilder().setLabel(opt.label).setValue(opt.value);
      if (opt.description) option.setDescription(opt.description);
      if (opt.emojiKey) {
        const e = emojiObj(opt.emojiKey);
        if (e) option.setEmoji(e);
      }
      if (opt.default) option.setDefault(true);
      return option;
    }),
  );
  return builder;
}

// ---------------------------------------------------------------------------
// Metin yardimcilari
// ---------------------------------------------------------------------------

/** Kucuk alt bilgi satiri: '-# metin' */
export function footerLine(parts) {
  const line = parts.filter(Boolean).join(' | ');
  return line ? `-# ${line}` : null;
}

/** Marka imzasi: tum kart alt bilgilerinde gorunur. */
export const BRAND = 'Xqeria Dev V1.1';

/** Alt bilgi metnini marka imzasiyla birlestirir; metin yoksa yalnizca imza doner. */
export function brandFooter(footer) {
  const base = typeof footer === 'string' ? footer.trim() : '';
  if (!base) return `-# ${BRAND}`;
  return base.includes(BRAND) ? base : `${base} | ${BRAND}`;
}

/** Baslik satiri: 'EMOJI **Baslik**' (emoji yoksa sadece baslik). */
export function titleLine(emojiKey, title) {
  const e = emojiKey ? emoji(emojiKey) : '';
  return e ? `${e} **${title}**` : `**${title}**`;
}

/** Madde listesi: ['a','b'] -> '- a\n- b' */
export function bullets(lines) {
  return lines.filter(Boolean).map((line) => `- ${line}`).join('\n');
}

// ---------------------------------------------------------------------------
// Payload yardimcilari
// ---------------------------------------------------------------------------

/** V2 bayragi ile bayrak uretir (ephemeral dahil). */
export function flagsFor({ ephemeral = false } = {}) {
  return ephemeral ? V2_FLAG | MessageFlags.Ephemeral : V2_FLAG;
}

/**
 * Gonderime hazir V2 payload uretir.
 * @param {{components: unknown[], ephemeral?: boolean, files?: unknown[], allowedMentions?: object}} opts
 */
export function payload({ components, ephemeral = false, files, allowedMentions } = {}) {
  const result = {
    components,
    flags: flagsFor({ ephemeral }),
    allowedMentions: allowedMentions ?? { parse: [] },
  };
  if (files && files.length > 0) result.files = files;
  return result;
}

/** Builder veya ham JSON'u derin olarak ham JSON'a cevirir (kopya uretir). */
function toRawDeep(node) {
  if (node === null || node === undefined) return node;
  if (typeof node.toJSON === 'function') return toRawDeep(node.toJSON());
  if (Array.isArray(node)) return node.map(toRawDeep);
  if (typeof node === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(node)) out[key] = toRawDeep(value);
    return out;
  }
  return node;
}

/**
 * Payload veya bilesen dizisindeki tum butonlari/select menuleri devre disi birakir.
 * Payload nesnesi verilirse bilesen DIZISI doner (disabledCard ile kullanilir).
 */
export function withDisabledButtons(input) {
  const source =
    input && !Array.isArray(input) && Array.isArray(input.components) ? input.components : input;
  const clone = toRawDeep(source);
  const stack = Array.isArray(clone) ? [...clone] : [clone];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    // Buton (2) ve tum select menu tipleri (3,5,6,7,8) kalici olarak devre disi birakilir
    if (node.type === 2 || (node.type >= 3 && node.type <= 8)) node.disabled = true;
    if (Array.isArray(node.components)) stack.push(...node.components);
    if (Array.isArray(node.items)) stack.push(...node.items);
    if (node.accessory) stack.push(node.accessory);
  }
  return clone;
}

/** Mevcut bir V2 payload'in bilesenlerini degistirip yeni payload uretir. */
export function replaceComponents(input, components) {
  const result = {
    components,
    flags: flagsFor({ ephemeral: false }),
    allowedMentions: { parse: [] },
  };
  if (input?.files?.length) result.files = input.files;
  return result;
}

export {
  ActionRowBuilder,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  FileBuilder,
  ThumbnailBuilder,
  TextDisplayBuilder,
};
export { getColor };
