/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  error as errorTemplate,
  list as listTemplate,
  success,
} from '../../../ui/templates/index.js';
import { DEFAULT_QUESTIONS, MAX_QUESTIONS, getDmQuestions, setDmQuestions } from '../lib/dmInterview.js';

export default {
  name: 'mülakat-sorular',
  aliases: ['mulakat-sorular', 'mulakat-sorulari'],
  description: 'Mülakat DM ön sorularını listeler veya günceller.',
  category: 'FiveM',
  system: 'mulakat',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'islem', type: 'string', required: true, description: 'liste|ayarla|sifirla' },
    { name: 'sorular', type: 'rest', required: false, description: 'Sorular — "|" ile ayrılmış tek satır' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const op = String(ctx.args.islem || '').toLowerCase();

    if (op === 'liste' || op === 'list') {
      const questions = await getDmQuestions(ctx.guild.id);
      const lines = questions.map((q, i) => t('fivem.mulakat.sorular_line', { sira: i + 1, soru: q }));
      await ctx.reply(listTemplate({ title: t('fivem.mulakat.sorular_title'), lines }));
      return;
    }

    if (op === 'ayarla' || op === 'set') {
      if (!ctx.db.ready) {
        await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
        return;
      }
      const raw = String(ctx.args.sorular || '').trim();
      const questions = raw.split('|').map((s) => s.trim()).filter(Boolean);
      if (!questions.length) {
        await ctx.reply(errorTemplate(t('fivem.mulakat.sorular_need_title'), [t('fivem.mulakat.sorular_need')]));
        return;
      }
      const saved = await setDmQuestions(ctx.guild.id, questions);
      const lines = saved.map((q, i) => t('fivem.mulakat.sorular_line', { sira: i + 1, soru: q }));
      await ctx.reply(
        success(t('fivem.mulakat.sorular_saved_title'), [
          t('fivem.mulakat.sorular_saved', { adet: saved.length }),
          ...lines,
        ]),
      );
      return;
    }

    if (op === 'sifirla' || op === 'reset') {
      if (!ctx.db.ready) {
        await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
        return;
      }
      await setDmQuestions(ctx.guild.id, []);
      const lines = DEFAULT_QUESTIONS.map((q, i) => t('fivem.mulakat.sorular_line', { sira: i + 1, soru: q }));
      await ctx.reply(
        success(t('fivem.mulakat.sorular_reset_title'), [
          t('fivem.mulakat.sorular_reset', { adet: DEFAULT_QUESTIONS.length }),
          ...lines,
        ]),
      );
      return;
    }

    await ctx.reply(
      errorTemplate(t('fivem.mulakat.sorular_usage_title'), [
        t('fivem.mulakat.sorular_usage_liste'),
        t('fivem.mulakat.sorular_usage_ayarla'),
        t('fivem.mulakat.sorular_usage_sifirla'),
        t('fivem.mulakat.sorular_usage_hint', { max: MAX_QUESTIONS }),
      ]),
    );
  },
};
