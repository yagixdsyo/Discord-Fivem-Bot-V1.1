/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { card } from '../../../ui/templates/base.js';
import { renderCoinPng, renderDicePng, renderSlotPng } from '../../../ui/canvas/games.js';
import { getColor } from '../../../ui/colors.js';
import { button, row } from '../../../ui/v2.js';
import { FUN_QUESTIONS } from './questions.js';
import { addScore, getScore, getTop } from './scoreboard.js';

/** Slot makinesi sembolleri (canvas kodlari). */
export const SLOT_FACES = Object.freeze(['CRZ', 'LIM', 'ZIL', 'YLD', 'YDI']);

/** Slot kazanci (puan) - panel ve isleyici ayni degeri kullanir. */
export const SLOT_WIN_SCORE = 10;

/** Trivia dogru cevap puani. */
export const TRIVIA_SCORE = 5;

function slotLabels(t) {
  return SLOT_FACES.map((code) => ({ code, label: t(`fun.slot_sym_${code.toLowerCase()}`) }));
}

/**
 * Zar sonucu payload'i (canvas + kart, yedekli).
 * @param {(key: string, vars?: object) => string} t
 * @param {{count?: number|string, sides?: number|string, ephemeral?: boolean}} opts
 */
export async function buildDicePayload(t, { count = 1, sides = 6, ephemeral = false } = {}) {
  const n = Math.max(1, Math.min(8, Number(count) || 1));
  const s = Math.max(2, Math.min(100, Number(sides) || 6));
  const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * s));
  const total = rolls.reduce((a, b) => a + b, 0);

  const title = t('fun.dice_title');
  const subtitle = t('fun.dice_subtitle', { adet: n, yuz: s });
  const line = t('fun.dice_line', { sonuc: rolls.join(' - '), toplam: total });

  const fileName = 'zar.png';
  const png = await renderDicePng({
    title,
    subtitle,
    rolls,
    sides: s,
    totalLabel: t('fun.dice_total', { toplam: total }),
    accent: getColor('primary'),
  });

  if (png) {
    return card({
      emojiKey: 'ZAR',
      title,
      subtitle,
      lines: [line],
      accent: 'primary',
      imageUrls: [`attachment://${fileName}`],
      files: [new AttachmentBuilder(png, { name: fileName })],
      ephemeral,
    });
  }

  return card({ emojiKey: 'ZAR', title, lines: [line], accent: 'primary', ephemeral });
}

/** Yazi-tura sonucu payload'i (canvas + kart, yedekli). */
export async function buildCoinPayload(t, { ephemeral = false } = {}) {
  const heads = Math.random() < 0.5;
  const resultText = t(heads ? 'fun.coin_heads' : 'fun.coin_tails');

  const title = t('fun.coin_title');
  const subtitle = t('fun.coin_subtitle');
  const line = t('fun.coin_line', { sonuc: resultText });

  const fileName = 'yazi-tura.png';
  const png = await renderCoinPng({
    title,
    subtitle,
    resultText,
    chipLabel: t('fun.result'),
    accent: getColor('primary'),
  });

  if (png) {
    return card({
      emojiKey: 'YAZI_TURA',
      title,
      subtitle,
      lines: [line],
      accent: 'primary',
      imageUrls: [`attachment://${fileName}`],
      files: [new AttachmentBuilder(png, { name: fileName })],
      ephemeral,
    });
  }

  return card({ emojiKey: 'YAZI_TURA', title, lines: [line], accent: 'primary', ephemeral });
}

/** Slot sonucu payload'i; kazancta puan ekler (canvas + kart, yedekli). */
export async function buildSlotPayload(t, { guildId = null, userId = null, ephemeral = false } = {}) {
  const pick = () => SLOT_FACES[Math.floor(Math.random() * SLOT_FACES.length)];
  const [a, b, c] = [pick(), pick(), pick()];
  const win = a === b && b === c;

  if (win && guildId && userId) await addScore(guildId, userId, SLOT_WIN_SCORE).catch(() => {});

  const labels = slotLabels(t);
  const reels = [a, b, c].map((code) => labels.find((entry) => entry.code === code) ?? { code, label: code });

  const title = t('fun.slot_title');
  const subtitle = t('fun.slot_subtitle', { puan: SLOT_WIN_SCORE });
  const line = t(win ? 'fun.slot_win' : 'fun.slot_loss', { slot: `${a} ${b} ${c}`, puan: SLOT_WIN_SCORE });

  const fileName = 'slot.png';
  const png = await renderSlotPng({
    title,
    subtitle,
    reels,
    win,
    statusText: t(win ? 'fun.slot_win_status' : 'fun.slot_loss_status', { puan: SLOT_WIN_SCORE }),
    accent: getColor('primary'),
  });

  if (png) {
    return card({
      emojiKey: 'SLOT',
      title,
      subtitle,
      lines: [line],
      accent: win ? 'success' : 'info',
      imageUrls: [`attachment://${fileName}`],
      files: [new AttachmentBuilder(png, { name: fileName })],
      ephemeral,
    });
  }

  return card({ emojiKey: 'SLOT', title, lines: [line], accent: win ? 'success' : 'info', ephemeral });
}

/**
 * Trivia soru paneli. Dogru cevap GORSELLESTIRILMEZ (buton stilleri esittir);
 * degerlendirme gizli yanitla yapilir.
 */
export function buildTriviaPayload(t, question, questionIndex, { ephemeral = false } = {}) {
  return card({
    emojiKey: 'TRIVIA',
    title: t('fun.trivia_title'),
    subtitle: t('fun.trivia_subtitle', { sayi: questionIndex + 1, toplam: FUN_QUESTIONS.length }),
    lines: [question.q, t('fun.trivia_hint')],
    accent: 'primary',
    buttons: [
      row(question.options.map((label, index) => button({
        id: `fun:trivia:${index}:${questionIndex}`,
        label,
        style: 'secondary',
      }))),
      row([
        button({ id: 'fun:trivia-yeni', label: t('fun.trivia_new'), emojiKey: 'YENILE', style: 'primary' }),
      ]),
    ],
    ephemeral,
  });
}

/** Kullanicinin puan + siralama karti (gizli yanit icin). */
export async function buildScorePayload(t, guildId, userId, { ephemeral = true } = {}) {
  const score = await getScore(guildId, userId);
  const top = await getTop(guildId, 100);
  const index = top.findIndex((entry) => entry.userId === userId);
  const rank = index >= 0 ? `#${index + 1}` : '-';

  return card({
    emojiKey: 'YILDIZ',
    title: t('fun.score_panel_title'),
    lines: [t('fun.score_panel_line', { puan: score, sira: rank })],
    accent: 'primary',
    ephemeral,
  });
}
