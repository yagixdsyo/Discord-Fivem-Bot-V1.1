/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from '../../../ui/templates/base.js';
import { getSetting, setSetting } from './state.js';
import { recordDmAnswers } from './interviews.js';

export const MAX_QUESTIONS = 10;
export const ANSWER_TIMEOUT_MS = 5 * 60_000;
const SETTINGS_KEY = 'mulakat_sorular';

export const DEFAULT_QUESTIONS = [
  'Adiniz, yasiniz ve yasadiginiz sehir nedir?',
  'FiveM / rol yapma deneyiminizi kisaca anlatir misiniz?',
  'Gunluk ortalama kac saat oynayabilirsiniz?',
  'Neden bu sunucuda gorev almak istiyorsunuz?',
  'Size referans olabilecek bir yetkili var mi? Varsa kim?',
];

/** Sunucuya ozel sorular (yoksa varsayilanlar). */
export async function getDmQuestions(guildId) {
  const raw = await getSetting(guildId, SETTINGS_KEY).catch(() => null);
  if (Array.isArray(raw) && raw.length) return raw.slice(0, MAX_QUESTIONS).map(String);
  return [...DEFAULT_QUESTIONS];
}

/**
 * Sorulari ayarlar; bos liste verilirse varsayilanlara doner.
 * @returns {Promise<string[]>} gecerli soru listesi
 */
export async function setDmQuestions(guildId, questions) {
  const clean = (questions ?? [])
    .map((q) => String(q ?? '').trim())
    .filter(Boolean)
    .slice(0, MAX_QUESTIONS);
  if (!clean.length) {
    await setSetting(guildId, SETTINGS_KEY, null);
    return [...DEFAULT_QUESTIONS];
  }
  await setSetting(guildId, SETTINGS_KEY, clean);
  return clean;
}

/**
 * DM kanalinda sorulari tek tek sorar ve yanitlari toplar.
 * Bitis: recordDmAnswers ile kayda islenir.
 *
 * @param {{t: Function, user: object, guildId: string, interviewId: string, questions: string[]}} opts
 * @returns {Promise<{ok: boolean, error?: 'dm_kapali'|'zaman_asimi'|'iptal', answers: object[], index?: number}>}
 */
export async function runDmQuestions({ t, user, guildId, interviewId, questions }) {
  const dm = user.dmChannel ?? (await user.createDM().catch(() => null));
  if (!dm) return { ok: false, error: 'dm_kapali', answers: [] };

  const answers = [];
  for (let index = 0; index < questions.length; index += 1) {
    await dm
      .send(
        card({
          emojiKey: 'MULAKAT',
          title: t('fivem.mulakat.dm_q_title', { sira: index + 1, toplam: questions.length }),
          lines: [questions[index], t('fivem.mulakat.dm_q_hint')],
          accent: 'primary',
        }),
      )
      .catch(() => null);

    const collected = await dm
      .awaitMessages({ filter: (m) => m.author?.id === user.id && !m.author.bot, max: 1, time: ANSWER_TIMEOUT_MS })
      .catch(() => null);
    const message = collected?.first?.() ?? null;

    if (!message) return { ok: false, error: 'zaman_asimi', answers, index };
    const text = String(message.content ?? '').trim();
    if (!text) {
      index -= 1;
      continue;
    }
    if (/^(iptal|cancel)$/i.test(text)) return { ok: false, error: 'iptal', answers, index };
    answers.push({ soru: questions[index], cevap: text.slice(0, 500), at: new Date().toISOString() });
  }

  await recordDmAnswers(guildId, interviewId, { answers, by: user.id });
  return { ok: true, answers };
}
