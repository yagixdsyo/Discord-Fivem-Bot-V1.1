/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, confirm as confirmTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { runConfirm } from '../../moderation/lib/uiFlow.js';
import { emitLog } from '../../logging/lib/emit.js';

export default {
  name: 'mesai-sıfırla',
  aliases: ['mesai-sifirla'],
  description: 'Bir kullanıcının mesai kayıtlarını onaylı şekilde sıfırlar.',
  category: 'Mesai',
  system: 'mesai',
  cooldown: 10,
  permission: { discord: ['ManageRoles'], node: 'shift.reset' },
  args: [{ name: 'kullanici', type: 'user', required: true, description: 'Hedef kullanıcı' }],

  async run(ctx) {
    const t = ctx.t;
    const arg = ctx.args.kullanici;
    const target = arg?.user ?? arg;
    const lib = await import('../lib/shifts.js');

    const active = await lib.findActiveShift(ctx.guild.id, target.id);
    if (active) {
      await ctx.reply(errorTemplate(t('shift.reset_active_title'), [t('shift.reset_active')]));
      return;
    }

    const periods = {
      gunluk: await lib.shiftTotalSeconds(ctx.guild.id, target.id, 'gunluk'),
      haftalik: await lib.shiftTotalSeconds(ctx.guild.id, target.id, 'haftalik'),
      aylik: await lib.shiftTotalSeconds(ctx.guild.id, target.id, 'aylik'),
      toplam: await lib.shiftTotalSeconds(ctx.guild.id, target.id, 'toplam'),
    };

    if (periods.toplam <= 0) {
      await ctx.reply(errorTemplate(t('shift.reset_empty_title'), [t('shift.reset_empty')]));
      return;
    }

    const ownerId = ctx.user.id;
    const payload = confirmTemplate({
      title: t('shift.reset_confirm_title'),
      description: [
        t('shift.reset_confirm_body', { kullanici: `<@${target.id}>` }),
        t('shift.reset_report_daily', { sure: lib.formatDuration(periods.gunluk) }),
        t('shift.reset_report_weekly', { sure: lib.formatDuration(periods.haftalik) }),
        t('shift.reset_report_monthly', { sure: lib.formatDuration(periods.aylik) }),
        t('shift.reset_report_total', { sure: lib.formatDuration(periods.toplam) }),
      ],
      confirmId: `mesaisifirlaonay:${ownerId}`,
      cancelId: `mesaisifirlaiptal:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });

    const confirmed = await runConfirm(ctx, {
      payload,
      ownerId,
      confirmId: `mesaisifirlaonay:${ownerId}`,
      cancelId: `mesaisifirlaiptal:${ownerId}`,
    });
    if (!confirmed) return;

    await lib.resetShift(ctx.guild.id, target.id);

    await emitLog(ctx.guild, 'log_mesai', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: target.id,
      targetTag: target.username,
      lines: [t('shift.reset_log', { kullanici: `<@${target.id}>`, sure: lib.formatDuration(periods.toplam) })],
      accent: 'warn',
    }).catch(() => {});

    await ctx.followUp(
      card({
        emojiKey: 'SIL',
        title: t('shift.reset_done_title'),
        lines: [t('shift.reset_done', { kullanici: `<@${target.id}>`, sure: lib.formatDuration(periods.toplam) })],
        accent: 'warn',
      }),
    );
  },
};
