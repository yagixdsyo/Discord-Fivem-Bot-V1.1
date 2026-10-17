/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import { renderCoinPng, renderDicePng, renderSlotPng } from '../src/ui/canvas/games.js';
import {
  buildCoinPayload,
  buildDicePayload,
  buildScorePayload,
  buildSlotPayload,
  buildTriviaPayload,
} from '../src/modules/fun/lib/games.js';
import { FUN_QUESTIONS } from '../src/modules/fun/lib/questions.js';
import { createTranslator } from '../src/locales/index.js';
import { card } from '../src/ui/templates/base.js';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

function isPng(buffer) {
  return Buffer.isBuffer(buffer) && PNG_MAGIC.every((byte, index) => buffer[index] === byte);
}

function collectButtons(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (node.type === 2) out.push(node);
  const children = [
    ...(Array.isArray(node.components) ? node.components : []),
    ...(Array.isArray(node.items) ? node.items : []),
  ];
  for (const child of children) collectButtons(child, out);
  return out;
}

const t = createTranslator('tr');

describe('oyun canvas gorselleri', () => {
  it('6 yuzlu zar karti PNG uretir', async () => {
    const png = await renderDicePng({
      title: t('fun.dice_title'),
      subtitle: t('fun.dice_subtitle', { adet: 3, yuz: 6 }),
      rolls: [1, 4, 6],
      sides: 6,
      totalLabel: t('fun.dice_total', { toplam: 11 }),
    });
    expect(isPng(png)).toBe(true);
  });

  it('cok yuzlu zar (sayili) PNG uretir', async () => {
    const png = await renderDicePng({ title: t('fun.dice_title'), rolls: [17], sides: 20 });
    expect(isPng(png)).toBe(true);
  });

  it('yazi-tura karti PNG uretir', async () => {
    const png = await renderCoinPng({
      title: t('fun.coin_title'),
      subtitle: t('fun.coin_subtitle'),
      resultText: t('fun.coin_heads'),
      chipLabel: t('fun.result'),
    });
    expect(isPng(png)).toBe(true);
  });

  it('slot karti (kazanc) PNG uretir', async () => {
    const png = await renderSlotPng({
      title: t('fun.slot_title'),
      subtitle: t('fun.slot_subtitle', { puan: 10 }),
      reels: [
        { code: 'CRZ', label: t('fun.slot_sym_crz') },
        { code: 'CRZ', label: t('fun.slot_sym_crz') },
        { code: 'CRZ', label: t('fun.slot_sym_crz') },
      ],
      win: true,
      statusText: t('fun.slot_win_status', { puan: 10 }),
    });
    expect(isPng(png)).toBe(true);
  });
});

describe('oyun payload ureticileri', () => {
  it('zar payload canvas dosyasi tasir', async () => {
    const payload = await buildDicePayload(t, { count: 2, sides: 6 });
    expect(payload.files).toHaveLength(1);
    expect(isPng(payload.files[0].attachment)).toBe(true);
  });

  it('yazi-tura payload canvas dosyasi tasir', async () => {
    const payload = await buildCoinPayload(t);
    expect(payload.files).toHaveLength(1);
    expect(isPng(payload.files[0].attachment)).toBe(true);
  });

  it('slot payload guild olmadan da uretilir', async () => {
    const payload = await buildSlotPayload(t, { guildId: null, userId: null });
    expect(payload.files).toHaveLength(1);
  });

  it('puan karti payload uretir', async () => {
    const payload = await buildScorePayload(t, 'g-fun-test', 'u-fun-test');
    expect(payload.components).toHaveLength(1);
    const raw = payload.components[0].toJSON();
    expect(raw.components.length).toBeGreaterThan(0);
  });
});

describe('trivia paneli', () => {
  it('dogru cevap butonlarda isaretlenmez (sizinti yok)', () => {
    const question = FUN_QUESTIONS[0];
    const payload = buildTriviaPayload(t, question, 0);
    const raw = payload.components[0].toJSON();
    const buttons = collectButtons(raw);

    const optionButtons = buttons.filter((entry) => String(entry.custom_id ?? '').startsWith('fun:trivia:'));
    expect(optionButtons).toHaveLength(question.options.length);
    for (const entry of optionButtons) {
      expect(entry.style).toBe(2); // hepsi secondary: dogru cevap ayirt edilemez
    }

    const newButton = buttons.find((entry) => entry.custom_id === 'fun:trivia-yeni');
    expect(newButton).toBeTruthy();
  });

  it('trivia payload soru metnini ve ipucunu tasir', () => {
    const question = FUN_QUESTIONS[1];
    const payload = buildTriviaPayload(t, question, 1);
    const raw = JSON.stringify(payload.components[0].toJSON());
    expect(raw).toContain(question.q);
  });
});

describe('oyun-merkezi ve rastgele kartlari', () => {
  it('oyun-merkezi komutu V2 kart dondurur', async () => {
    const command = (await import('../src/modules/fun/commands/oyun-merkezi.js')).default;
    const replies = [];
    await command.run({ t, args: {}, reply: async (payload) => replies.push(payload) });
    expect(replies).toHaveLength(1);
    expect(replies[0].components).toHaveLength(1);
  });

  it('zar komutu canvas payload gonderir', async () => {
    const command = (await import('../src/modules/fun/commands/zar.js')).default;
    const replies = [];
    await command.run({ t, args: {}, reply: async (payload) => replies.push(payload) });
    expect(replies).toHaveLength(1);
    expect(replies[0].files).toHaveLength(1);
  });

  it('card() yeni fun anahtarlariyla cizilebilir', () => {
    const payload = card({
      emojiKey: 'OYUN',
      title: t('fun.panel_title'),
      lines: [t('fun.panel_games'), t('fun.panel_points')],
      footer: `-# ${t('fun.panel_footer')}`,
    });
    expect(payload.components).toHaveLength(1);
  });
});
