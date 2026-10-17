/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerComponentHandler } from '../../ui/interactionRouter.js';
import { error as errorTemplate } from '../../ui/templates/index.js';
import { card } from '../../ui/templates/base.js';
import { addScore } from './lib/scoreboard.js';
import {
  buildCoinPayload,
  buildDicePayload,
  buildScorePayload,
  buildSlotPayload,
  buildTriviaPayload,
  TRIVIA_SCORE,
} from './lib/games.js';
import { FUN_QUESTIONS } from './lib/questions.js';

const ready = { done: false };

function randomQuestion() {
  const index = Math.floor(Math.random() * FUN_QUESTIONS.length);
  return { index, question: FUN_QUESTIONS[index] };
}

function registerHandlers() {
  if (ready.done) return;
  ready.done = true;
  registerComponentHandler('fun', async (interaction, rest) => {
    const { createTranslator } = await import('../../locales/index.js');
    const t = createTranslator();
    const [action, ...params] = rest || [];

    if (action === 'zar' || action === 'yazi' || action === 'slot' || action === 'skor') {
      let payload;
      if (action === 'zar') {
        payload = await buildDicePayload(t, { count: params[0], sides: params[1], ephemeral: true });
      } else if (action === 'yazi') {
        payload = await buildCoinPayload(t, { ephemeral: true });
      } else if (action === 'slot') {
        payload = await buildSlotPayload(t, {
          guildId: interaction.guildId,
          userId: interaction.user?.id ?? null,
          ephemeral: true,
        });
      } else {
        payload = await buildScorePayload(t, interaction.guildId, interaction.user?.id ?? null, { ephemeral: true });
      }
      await interaction.reply(payload).catch(() => {});
      return;
    }

    if (action === 'trivia-baslat') {
      const { index, question } = randomQuestion();
      await interaction.reply(buildTriviaPayload(t, question, index, { ephemeral: true })).catch(() => {});
      return;
    }

    if (action === 'trivia-yeni') {
      const { index, question } = randomQuestion();
      await interaction.update(buildTriviaPayload(t, question, index)).catch(() => {});
      return;
    }

    if (action === 'trivia') {
      const choice = Number(params[0]);
      const questionIndex = Number(params[1]);
      const question = FUN_QUESTIONS[questionIndex];
      if (!question) {
        await interaction.reply({ ...errorTemplate(t('fun.unknown_title'), [t('fun.unknown')]), ephemeral: true }).catch(() => {});
        return;
      }
      const ok = choice === question.correct;
      if (ok) await addScore(interaction.guildId, interaction.user?.id ?? null, TRIVIA_SCORE).catch(() => {});

      const payload = card({
        emojiKey: ok ? 'ONAY' : 'RED',
        title: t('fun.trivia_title'),
        lines: [
          ok ? t('fun.trivia_correct') : t('fun.trivia_wrong'),
          t('fun.trivia_answer', { cevap: question.options[question.correct] }),
          ok ? t('fun.trivia_score', { puan: TRIVIA_SCORE }) : t('fun.trivia_no_score'),
        ],
        accent: ok ? 'success' : 'error',
        ephemeral: true,
      });
      await interaction.reply(payload).catch(() => {});
      return;
    }

    await interaction.reply({ ...errorTemplate(t('fun.unknown_title'), [t('fun.unknown')]), ephemeral: true }).catch(() => {});
  });
}

export default {
  id: 'fun',
  name: 'Eglence',
  description: 'Gelismis FiveM temali mini oyunlar ve kullanici komutlari.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,
  async setup(client, { logger }) {
    registerHandlers();
    logger.info('Eglence modulu hazir');
  },
};
