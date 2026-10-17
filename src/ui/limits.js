/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export const V2_FLAG = 1 << 15; // MessageFlags.IsComponentsV2
export const EPHEMERAL_FLAG = 1 << 6; // MessageFlags.Ephemeral

export const LIMITS = Object.freeze({
  MAX_COMPONENTS_TOTAL: 40,
  MAX_COMPONENTS_TOP_LEVEL: 10,
  MAX_TEXT_TOTAL: 4000,
  MAX_TEXT_DISPLAY: 4000,
  MAX_ACTION_ROW_ITEMS: 5,
  MAX_SELECT_OPTIONS: 25,
  MAX_MEDIA_ITEMS: 10,
  MAX_SECTION_TEXTS: 3,
  MAX_BUTTON_LABEL: 80,
  MAX_OPTION_LABEL: 100,
  MAX_OPTION_DESCRIPTION: 100,
  MAX_CUSTOM_ID: 100,
  MAX_FILES: 10,
});

/** Bilesen tipi sabitleri (discord.js ComponentType ile ayni). */
export const C = Object.freeze({
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  TextInput: 4,
  UserSelect: 5,
  RoleSelect: 6,
  MentionableSelect: 7,
  ChannelSelect: 8,
  Section: 9,
  TextDisplay: 10,
  Thumbnail: 11,
  MediaGallery: 12,
  File: 13,
  Separator: 14,
  Container: 17,
});

const SELECT_TYPES = new Set([C.StringSelect, C.UserSelect, C.RoleSelect, C.MentionableSelect, C.ChannelSelect]);

/** Builder veya ham JSON'u ham JSON'a cevirir. */
export function toRaw(component) {
  if (component === null || component === undefined) return component;
  if (typeof component.toJSON === 'function') return component.toJSON();
  return component;
}

/** Agac genelinde bilesen sayar (ic ice dahil). */
export function countComponents(components) {
  let count = 0;
  const stack = Array.isArray(components) ? [...components] : [components];
  while (stack.length > 0) {
    const node = toRaw(stack.pop());
    if (!node || typeof node !== 'object') continue;
    count += 1;
    if (Array.isArray(node.components)) stack.push(...node.components);
    if (Array.isArray(node.items)) stack.push(...node.items);
    if (node.accessory) stack.push(node.accessory);
  }
  return count;
}

/** Toplam TextDisplay metin uzunlugu. */
export function totalTextLength(components) {
  let length = 0;
  const stack = Array.isArray(components) ? [...components] : [components];
  while (stack.length > 0) {
    const node = toRaw(stack.pop());
    if (!node || typeof node !== 'object') continue;
    if (node.type === C.TextDisplay && typeof node.content === 'string') {
      length += node.content.length;
    }
    if (Array.isArray(node.components)) stack.push(...node.components);
    if (Array.isArray(node.items)) stack.push(...node.items);
    if (node.accessory) stack.push(node.accessory);
  }
  return length;
}

/**
 * V2 payload'ini gonderim oncesi dogrular.
 * @param {{components?: unknown[], flags?: number, content?: unknown, embeds?: unknown, poll?: unknown, stickers?: unknown, files?: unknown[]}} payload
 * @param {{ requireV2Flag?: boolean, maxText?: number }} [opts]
 * @returns {{ ok: boolean, errors: string[], stats: { components: number, textLength: number, topLevel: number } }}
 */
export function validateV2Payload(payload, opts = {}) {
  const { requireV2Flag = true, maxText = LIMITS.MAX_TEXT_TOTAL } = opts;
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['Payload bir nesne olmali'], stats: { components: 0, textLength: 0, topLevel: 0 } };
  }

  // V2 ile birlikte kullanilamayan alanlar
  if (payload.content !== undefined && payload.content !== null) errors.push('V2 mesajda "content" kullanilamaz');
  if (payload.embeds !== undefined && payload.embeds !== null && payload.embeds.length !== 0) {
    errors.push('V2 mesajda "embeds" kullanilamaz');
  }
  if (payload.poll !== undefined && payload.poll !== null) errors.push('V2 mesajda "poll" kullanilamaz');
  if (payload.stickers !== undefined && payload.stickers !== null && payload.stickers.length !== 0) {
    errors.push('V2 mesajda "stickers" kullanilamaz');
  }

  if (requireV2Flag && (!payload.flags || (payload.flags & V2_FLAG) === 0)) {
    errors.push('Mesaj bayragi IsComponentsV2 (1 << 15) icermiyor');
  }

  const components = payload.components ?? [];
  const topLevel = Array.isArray(components) ? components.length : 0;

  if (topLevel > LIMITS.MAX_COMPONENTS_TOP_LEVEL) {
    errors.push(`Ust seviye bilesen sayisi ${topLevel} > ${LIMITS.MAX_COMPONENTS_TOP_LEVEL}`);
  }

  const total = countComponents(components);
  if (total > LIMITS.MAX_COMPONENTS_TOTAL) {
    errors.push(`Toplam bilesen sayisi ${total} > ${LIMITS.MAX_COMPONENTS_TOTAL}`);
  }

  const textLength = totalTextLength(components);
  if (textLength > maxText) {
    errors.push(`Toplam metin uzunlugu ${textLength} > ${maxText}`);
  }

  if (Array.isArray(payload.files) && payload.files.length > LIMITS.MAX_FILES) {
    errors.push(`Dosya sayisi ${payload.files.length} > ${LIMITS.MAX_FILES}`);
  }

  // --- Derin dogrulama ---
  const walk = (nodes, inSection = false) => {
    for (const raw of nodes ?? []) {
      const node = toRaw(raw);
      if (!node || typeof node !== 'object' || typeof node.type !== 'number') {
        errors.push('Gecersiz bilesen (type yok)');
        continue;
      }

      switch (node.type) {
        case C.ActionRow: {
          const children = node.components ?? [];
          const selects = children.filter((c) => SELECT_TYPES.has(c.type));
          const buttons = children.filter((c) => c.type === C.Button);
          if (selects.length > 0 && children.length > 1) {
            errors.push('ActionRow select menu ile baska bilesen karistirilamaz');
          }
          if (buttons.length > LIMITS.MAX_ACTION_ROW_ITEMS) {
            errors.push(`ActionRow icinde ${buttons.length} buton > ${LIMITS.MAX_ACTION_ROW_ITEMS}`);
          }
          if (children.length === 0) errors.push('Bos ActionRow gonderilemez');
          walk(children);
          break;
        }
        case C.Button: {
          if (node.style !== 5) {
            if (!node.custom_id) errors.push('Buton custom_id zorunlu');
          }
          if (node.custom_id && node.custom_id.length > LIMITS.MAX_CUSTOM_ID) {
            errors.push(`custom_id ${node.custom_id.length} > ${LIMITS.MAX_CUSTOM_ID}`);
          }
          if (node.label && node.label.length > LIMITS.MAX_BUTTON_LABEL) {
            errors.push(`Buton label ${node.label.length} > ${LIMITS.MAX_BUTTON_LABEL}`);
          }
          if (!node.label && !node.emoji) errors.push('Butonda label veya emoji olmali');
          break;
        }
        case C.StringSelect: {
          if (node.custom_id && node.custom_id.length > LIMITS.MAX_CUSTOM_ID) {
            errors.push(`custom_id ${node.custom_id.length} > ${LIMITS.MAX_CUSTOM_ID}`);
          }
          const options = node.options ?? [];
          if (options.length === 0) errors.push('StringSelect en az 1 secenek ister');
          if (options.length > LIMITS.MAX_SELECT_OPTIONS) {
            errors.push(`Secenek sayisi ${options.length} > ${LIMITS.MAX_SELECT_OPTIONS}`);
          }
          for (const opt of options) {
            if (opt.label && opt.label.length > LIMITS.MAX_OPTION_LABEL) {
              errors.push('Select secenegi label siniri asildi');
            }
          }
          break;
        }
        case C.UserSelect:
        case C.RoleSelect:
        case C.MentionableSelect:
        case C.ChannelSelect: {
          if (node.custom_id && node.custom_id.length > LIMITS.MAX_CUSTOM_ID) {
            errors.push(`custom_id ${node.custom_id.length} > ${LIMITS.MAX_CUSTOM_ID}`);
          }
          break;
        }
        case C.Section: {
          const children = node.components ?? [];
          const textCount = children.filter((c) => c.type === C.TextDisplay).length;
          if (textCount === 0) errors.push('Section en az 1 TextDisplay ister');
          if (textCount > LIMITS.MAX_SECTION_TEXTS) {
            errors.push(`Section icinde ${textCount} TextDisplay > ${LIMITS.MAX_SECTION_TEXTS}`);
          }
          if (!node.accessory) {
            errors.push('Section accessory (Button veya Thumbnail) zorunlu');
          } else if (node.accessory.type !== C.Button && node.accessory.type !== C.Thumbnail) {
            errors.push('Section accessory yalnizca Button veya Thumbnail olabilir');
          }
          walk([...(node.accessory ? [node.accessory] : []), ...children], true);
          break;
        }
        case C.MediaGallery: {
          const items = node.items ?? [];
          if (items.length === 0) errors.push('MediaGallery en az 1 oge ister');
          if (items.length > LIMITS.MAX_MEDIA_ITEMS) {
            errors.push(`MediaGallery ${items.length} oge > ${LIMITS.MAX_MEDIA_ITEMS}`);
          }
          break;
        }
        case C.File: {
          if (!node.file || !node.file.url) errors.push('File bileseni file.url ister');
          break;
        }
        case C.TextDisplay: {
          if (typeof node.content !== 'string' || node.content.length === 0) {
            errors.push('TextDisplay content zorunlu');
          }
          if (node.content && node.content.length > LIMITS.MAX_TEXT_DISPLAY) {
            errors.push(`TextDisplay icerigi ${node.content.length} > ${LIMITS.MAX_TEXT_DISPLAY}`);
          }
          break;
        }
        case C.Container:
        case C.Separator:
        case C.Thumbnail: {
          if (node.type === C.Container) walk(node.components ?? []);
          break;
        }
        default:
          errors.push(`Bilinmeyen bilesen tipi: ${node.type}`);
      }
    }
  };

  walk(components);

  return { ok: errors.length === 0, errors, stats: { components: total, textLength, topLevel } };
}

/** Gonderimden once dogrulayi calistirip hata varsa firlatir (gelistirici korumasi). */
export function assertV2Payload(payload, label = 'payload') {
  const result = validateV2Payload(payload);
  if (!result.ok) {
    throw new Error(`[V2 Dogrulama] ${label}: ${result.errors.join('; ')}`);
  }
  return payload;
}
