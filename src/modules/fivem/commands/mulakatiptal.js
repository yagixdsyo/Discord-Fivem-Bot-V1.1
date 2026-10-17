/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { confirm as confirmTemplate, error as errorTemplate, success } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { runConfirm } from '../../moderation/lib/uiFlow.js';
import { cancelInterview, getActiveByUser } from '../lib/interviews.js';

export default {
  name: 'mülakat-iptal',
  aliases: ['mulakat-iptal'],
  description: 'Bir kullanıcının aktif mülakat davetini iptal eder.',
  category: 'FiveM',
  system: 'mulakat',
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [{ name: 'kullanici', type: 'user', required: true, description: 'Kullanıcı' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const arg = ctx.args.kullanici;
    const user = arg?.user ?? arg;
    const doc = await getActiveByUser(ctx.guild.id, user.id);
    if (!doc) {
      await ctx.reply(errorTemplate(t('fivem.mulakat.no_active_title'), [t('fivem.mulakat.no_active', { kullanici: `<@${user.id}>` })]));
      return;
    }

    const ownerId = ctx.user.id;
    const payload = confirmTemplate({
      title: t('fivem.mulakat.cancel_confirm_title'),
      description: [t('fivem.mulakat.cancel_confirm_body', { kullanici: `<@${user.id}>`, durum: t(`fivem.mulakat.status_label.${doc.status}`) })],
      confirmId: `mulakatiptalonay:${ownerId}`,
      cancelId: `mulakatiptaliptal:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });
    const confirmed = await runConfirm(ctx, {
      payload,
      ownerId,
      confirmId: `mulakatiptalonay:${ownerId}`,
      cancelId: `mulakatiptaliptal:${ownerId}`,
    });
    if (!confirmed) return;

    const result = await cancelInterview(ctx.guild.id, doc.interview_id, { by: ctx.user.id });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.mulakat.cancel_fail_title'), [t('fivem.mulakat.cancel_fail')]));
      return;
    }

    await user
      .send(
        success(t('fivem.mulakat.cancel_dm_title'), [t('fivem.mulakat.cancel_dm', { sunucu: ctx.guild.name })]),
      )
      .catch(() => {});

    await emitLog(ctx.guild, 'log_mulakat', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: user.id,
      targetTag: user.username,
      lines: [t('fivem.mulakat.log_cancelled', { kullanici: `<@${user.id}>` })],
      accent: 'warn',
    });

    await ctx.followUp(success(t('fivem.mulakat.cancelled_title'), [t('fivem.mulakat.cancelled_line', { kullanici: `<@${user.id}>` })]));
  },
};
