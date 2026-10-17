/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import {
  V2_FLAG,
  LIMITS,
  validateV2Payload,
  countComponents,
  totalTextLength,
} from '../src/ui/limits.js';

// ---------------------------------------------------------------------------
// Ham JSON yardimcilari
// ---------------------------------------------------------------------------

const T = (content) => ({ type: 10, content });
const ROW = (...children) => ({ type: 1, components: children });
const BTN = (over = {}) => ({ type: 2, style: 1, custom_id: 'btn', label: 'Buton', ...over });
const SELECT = (options) => ({ type: 3, custom_id: 'sel', placeholder: 'Seç', options });
const CONTAINER = (...children) => ({ type: 17, accent_color: 0x5865f2, components: children });
const THUMB = { type: 11, media: { url: 'https://x/y.png' } };
const SECTION = (texts, accessory = THUMB) => ({
  type: 9,
  components: texts.map((t) => T(t)),
  ...(accessory ? { accessory } : {}),
});
const GALLERY = (items) => ({ type: 12, items });

const wrap = (components) => ({ components, flags: V2_FLAG, allowedMentions: { parse: [] } });

// ---------------------------------------------------------------------------
// countComponents / totalTextLength
// ---------------------------------------------------------------------------

describe('countComponents', () => {
  it('ic ice bilesenleri sayar', () => {
    const tree = CONTAINER(SECTION(['a'], { type: 11, media: { url: 'https://x/y.png' } }), ROW(BTN()));
    // container + section + text + thumbnail + row + button = 6
    expect(countComponents([tree])).toBe(6);
  });

  it('bos girdide 0 doner', () => {
    expect(countComponents([])).toBe(0);
    expect(countComponents(undefined)).toBe(0);
  });
});

describe('totalTextLength', () => {
  it('tum TextDisplay iceriklerini toplar', () => {
    expect(totalTextLength([T('abc'), CONTAINER(T('de'))])).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// validateV2Payload - kabul
// ---------------------------------------------------------------------------

describe('validateV2Payload - gecerli payloadlar', () => {
  it('basit container + text gecerli', () => {
    const r = validateV2Payload(wrap([CONTAINER(T('Merhaba'))]));
    expect(r.ok).toBe(true);
    expect(r.stats.components).toBe(2);
    expect(r.stats.topLevel).toBe(1);
  });

  it('section + accessory + action row gecerli', () => {
    const payload = wrap([
      CONTAINER(SECTION(['a'], BTN()), ROW(BTN({ style: 3 }), BTN({ style: 4 }))),
    ]);
    expect(validateV2Payload(payload).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateV2Payload - red
// ---------------------------------------------------------------------------

describe('validateV2Payload - yasaklar', () => {
  it('content kullanimi reddedilir', () => {
    const r = validateV2Payload({ ...wrap([CONTAINER(T('x'))]), content: 'selam' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('content'))).toBe(true);
  });

  it('embeds kullanimi reddedilir', () => {
    const r = validateV2Payload({ ...wrap([CONTAINER(T('x'))]), embeds: [{ title: 'x' }] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('embeds'))).toBe(true);
  });

  it('V2 bayragi yoksa reddedilir', () => {
    const r = validateV2Payload({ components: [CONTAINER(T('x'))] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('IsComponentsV2'))).toBe(true);
  });

  it('requireV2Flag=false ile bayrak aranmaz', () => {
    const r = validateV2Payload({ components: [CONTAINER(T('x'))] }, { requireV2Flag: false });
    expect(r.ok).toBe(true);
  });
});

describe('validateV2Payload - ActionRow kurallari', () => {
  it('select ile buton karisamaz', () => {
    const r = validateV2Payload(wrap([CONTAINER(ROW(SELECT([{ label: 'A', value: 'a' }]), BTN()))]));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('select menu'))).toBe(true);
  });

  it('5 ten fazla buton konamaz', () => {
    const buttons = Array.from({ length: 6 }, (_, i) => BTN({ custom_id: `b${i}` }));
    const r = validateV2Payload(wrap([CONTAINER(ROW(...buttons))]));
    expect(r.ok).toBe(false);
  });

  it('bos ActionRow gonderilemez', () => {
    const r = validateV2Payload(wrap([CONTAINER(ROW())]));
    expect(r.ok).toBe(false);
  });
});

describe('validateV2Payload - bilesen kurallari', () => {
  it('buton label/emoji olmadan reddedilir', () => {
    const r = validateV2Payload(wrap([CONTAINER(ROW(BTN({ label: undefined })))]));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('label veya emoji'))).toBe(true);
  });

  it('bos TextDisplay reddedilir', () => {
    const r = validateV2Payload(wrap([CONTAINER({ type: 10, content: '' })]));
    expect(r.ok).toBe(false);
  });

  it('Section en fazla 3 TextDisplay alir', () => {
    const r = validateV2Payload(wrap([CONTAINER(SECTION(['a', 'b', 'c', 'd']))]));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('TextDisplay >'))).toBe(true);
  });

  it('Section accessory zorunludur', () => {
    const r = validateV2Payload(wrap([CONTAINER(SECTION(['a'], null))]));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('accessory'))).toBe(true);
  });

  it('Section accessory yalnizca Button/Thumbnail olabilir', () => {
    const r = validateV2Payload(wrap([CONTAINER(SECTION(['a'], T('b')))]));
    expect(r.ok).toBe(false);
  });

  it('StringSelect en az 1 secenek ister', () => {
    const r = validateV2Payload(wrap([CONTAINER(ROW(SELECT([])))]));
    expect(r.ok).toBe(false);
  });

  it('25 ten fazla secenek reddedilir', () => {
    const options = Array.from({ length: 26 }, (_, i) => ({ label: `S${i}`, value: `s${i}` }));
    const r = validateV2Payload(wrap([CONTAINER(ROW(SELECT(options)))]));
    expect(r.ok).toBe(false);
  });

  it('bos MediaGallery reddedilir, 10 uzeri reddedilir', () => {
    expect(validateV2Payload(wrap([CONTAINER(GALLERY([]))])).ok).toBe(false);
    const many = Array.from({ length: 11 }, () => ({ media: { url: 'https://x/y.png' } }));
    expect(validateV2Payload(wrap([CONTAINER(GALLERY(many))])).ok).toBe(false);
  });

  it('File bileseni file.url ister', () => {
    expect(validateV2Payload(wrap([CONTAINER({ type: 13 })])).ok).toBe(false);
    expect(
      validateV2Payload(wrap([CONTAINER({ type: 13, file: { url: 'attachment://x.png' } })])).ok,
    ).toBe(true);
  });

  it('bilinmeyen bilesen tipi reddedilir', () => {
    const r = validateV2Payload(wrap([CONTAINER({ type: 99 })]));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('Bilinmeyen'))).toBe(true);
  });
});

describe('validateV2Payload - sayim limitleri', () => {
  it('toplam 40 bileseni asan payload reddedilir', () => {
    const texts = Array.from({ length: 45 }, (_, i) => T(`satır ${i}`));
    const r = validateV2Payload(wrap([CONTAINER(...texts)]));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('Toplam bilesen'))).toBe(true);
  });

  it('ust seviye 10 bileseni asan payload reddedilir', () => {
    const children = Array.from({ length: 11 }, (_, i) => T(`x${i}`));
    const r = validateV2Payload(wrap(children));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('Ust seviye'))).toBe(true);
  });

  it('4000 karakter ustu metin reddedilir', () => {
    const r = validateV2Payload(wrap([CONTAINER(T('a'.repeat(4001)))]));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('metin'))).toBe(true);
  });

  it('LIMITS sabitleri beklenen degerlerde', () => {
    expect(LIMITS.MAX_COMPONENTS_TOTAL).toBe(40);
    expect(LIMITS.MAX_TEXT_TOTAL).toBe(4000);
    expect(LIMITS.MAX_SELECT_OPTIONS).toBe(25);
  });
});
