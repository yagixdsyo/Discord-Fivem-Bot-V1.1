/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { confirm as confirmTemplate, error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { emitLog } from '../../logging/lib/emit.js';
import { runConfirm } from '../../moderation/lib/uiFlow.js';
import { getDonate, removeDonate } from '../lib/donate.js';

export default {
  name: 'donate-sil',
  aliases: ['donatesil'],
  description: 'Bir donate kaydını siler (onaylı).',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [{ name: 'kayit', type: 'string', required: true, description: 'Kayıt kodu (d-...)' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const key = String(ctx.args.kayit ?? '').trim();
    const doc = await getDonate(ctx.guild.id, key);
    if (!doc) {
      await ctx.reply(errorTemplate(t('fivem.donate.not_found_title'), [t('fivem.donate.not_found', { kod: key })]));
      return;
    }

    const ownerId = ctx.user.id;
    const payload = confirmTemplate({
      title: t('fivem.donate.delete_confirm_title'),
      description: [
        t('fivem.donate.delete_confirm_body', { kullanici: `<@${doc.user_id}>`, paket: `**${doc.package}**`, kod: `\`${doc.donate_id}\`` }),
      ],
      confirmId: `donatesilonay:${ownerId}`,
      cancelId: `donatesiliptal:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });
    const confirmed = await runConfirm(ctx, {
      payload,
      ownerId,
      confirmId: `donatesilonay:${ownerId}`,
      cancelId: `donatesiliptal:${ownerId}`,
    });
    if (!confirmed) return;

    const removed = await removeDonate(ctx.guild.id, doc.donate_id);
    if (!removed) {
      await ctx.reply(errorTemplate(t('fivem.donate.not_found_title'), [t('fivem.donate.not_found', { kod: key })]));
      return;
    }

    await emitLog(ctx.guild, 'log_donate', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: doc.user_id,
      targetTag: doc.user_tag,
      lines: [t('fivem.donate.log_deleted', { kullanici: `<@${doc.user_id}>`, paket: `**${doc.package}**`, kod: `\`${doc.donate_id}\`` })],
      accent: 'warn',
    });

    await ctx.followUp(
      card({
        emojiKey: 'DONATE',
        title: t('fivem.donate.deleted_title'),
        lines: [t('fivem.donate.deleted', { kod: `\`${doc.donate_id}\`` })],
        accent: 'warn',
        footer: `\`${doc.donate_id}\``,
      }),
    );
  },
};
