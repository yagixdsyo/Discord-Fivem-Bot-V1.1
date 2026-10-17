/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { confirm as confirmTemplate, error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { emitLog } from '../../logging/lib/emit.js';
import { closeOlusum, getOlusum } from '../lib/olusum.js';
import { runConfirm } from '../../moderation/lib/uiFlow.js';

export default {
  name: 'oluşum-kapat',
  aliases: ['olusum-kapat'],
  description: 'Bir oluşum kaydını kapatır (onaylı).',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [{ name: 'olusum', type: 'string', required: true, description: 'Oluşum adı veya ID' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const key = String(ctx.args.olusum ?? '').trim();
    const doc = (await getOlusum(ctx.guild.id, { olusumId: key })) ?? (await getOlusum(ctx.guild.id, { name: key }));
    if (!doc || !doc.active) {
      await ctx.reply(errorTemplate(t('fivem.olusum.not_found_title'), [t('fivem.olusum.not_found', { olusum: key })]));
      return;
    }

    const ownerId = ctx.user.id;
    const payload = confirmTemplate({
      title: t('fivem.olusum.close_confirm_title'),
      description: [t('fivem.olusum.close_confirm_body', { ad: `**${doc.name}**`, rol: `<@&${doc.role_id}>` })],
      confirmId: `olusumkapatonay:${ownerId}`,
      cancelId: `olusumkapitaiptal:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });

    const confirmed = await runConfirm(ctx, {
      payload,
      ownerId,
      confirmId: `olusumkapatonay:${ownerId}`,
      cancelId: `olusumkapitaiptal:${ownerId}`,
    });
    if (!confirmed) return;

    const result = await closeOlusum(ctx.guild.id, doc.olusum_id);
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.olusum.close_fail_title'), [t('fivem.olusum.close_fail')]));
      return;
    }

    await emitLog(ctx.guild, 'log_olusum_bilgi', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [t('fivem.olusum.log_closed', { ad: `**${doc.name}**`, rol: `<@&${doc.role_id}>` })],
      accent: 'warn',
    });

    await ctx.followUp(
      card({
        emojiKey: 'OLUSUM',
        title: t('fivem.olusum.closed_title'),
        lines: [t('fivem.olusum.closed_line', { ad: `**${doc.name}**` })],
        accent: 'warn',
        footer: `\`${doc.olusum_id}\``,
      }),
    );
  },
};
