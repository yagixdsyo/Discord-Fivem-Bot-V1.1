/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { emitLog } from '../../logging/lib/emit.js';
import { addFeedback, officerFeedbackStats } from '../lib/complaints.js';

export default {
  name: 'feedback',
  aliases: [],
  description: 'Bir yetkili hakkında 1-5 puanlı geri bildirim bırakır.',
  category: 'FiveM',
  system: null,
  cooldown: 60,
  permission: { discord: [] },
  args: [
    { name: 'yetkili', type: 'user', required: true, description: 'Değerlendirilecek yetkili' },
    { name: 'puan', type: 'integer', required: true, description: '1-5 arası puan' },
    { name: 'yorum', type: 'rest', required: false, description: 'Yorum' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const arg = ctx.args.yetkili;
    const officer = arg?.user ?? arg;
    const score = Number(ctx.args.puan ?? 0);
    if (!officer || officer.bot || officer.id === ctx.user.id) {
      await ctx.reply(errorTemplate(t('fivem.sikayet.feedback_officer_invalid_title'), [t('fivem.sikayet.feedback_officer_invalid')]));
      return;
    }
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      await ctx.reply(errorTemplate(t('fivem.sikayet.feedback_score_invalid_title'), [t('fivem.sikayet.feedback_score_invalid')]));
      return;
    }

    const comment = ctx.args.yorum ? String(ctx.args.yorum).trim().slice(0, 500) : null;
    await addFeedback({
      guildId: ctx.guild.id,
      userId: ctx.user.id,
      userTag: ctx.user.username ?? null,
      officerId: officer.id,
      officerTag: officer.username ?? null,
      score,
      comment,
    });

    const stats = await officerFeedbackStats(ctx.guild.id, officer.id);

    await emitLog(ctx.guild, 'log_feedback', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: officer.id,
      targetTag: officer.username,
      lines: [
        t('fivem.sikayet.feedback_log', { yetkili: `<@${officer.id}>`, puan: `**${score}/5**` }),
        comment ? t('fivem.sikayet.feedback_log_comment', { yorum: comment }) : null,
      ].filter(Boolean),
      accent: score >= 4 ? 'success' : score >= 3 ? 'warn' : 'error',
    });

    await ctx.reply(
      card({
        emojiKey: 'SIKAYET',
        title: t('fivem.sikayet.feedback_title'),
        lines: [
          t('fivem.sikayet.feedback_line', {
            yetkili: `<@${officer.id}>`,
            puan: `**${score}/5**`,
            ortalama: `**${stats.average.toFixed(1)}** (${stats.total})`,
          }),
        ],
        accent: score >= 4 ? 'success' : score >= 3 ? 'warn' : 'error',
      }),
    );
  },
};
