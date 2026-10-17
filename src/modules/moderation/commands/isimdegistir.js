/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success as successTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { ensurePunishAllowed, punishErrorCard, reasonText } from '../lib/punishFlow.js';

export default {
  name: 'isim-değiştir',
  aliases: ['isimdegistir', 'nick'],
  description: 'Bir üyenin takma adını değiştirir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  permission: { discord: ['ManageNicknames'], node: 'moderation.isim' },
  args: [
    { name: 'kullanici', type: 'member', required: true, description: 'Üye' },
    { name: 'isim', type: 'string', required: true, description: 'Yeni takma ad (tırnaklı tek parça)' },
    { name: 'sebep', type: 'rest', required: false, description: 'Sebep' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const targetMember = ctx.args.kullanici;
    const targetUser = targetMember.user;
    const yeni = String(ctx.args.isim ?? '').trim().slice(0, 32);

    if (!yeni) {
      await ctx.reply(errorTemplate(t('moderation.nickname.empty_title'), [t('moderation.nickname.empty_body')]));
      return;
    }

    const problem = await ensurePunishAllowed(ctx, {
      targetUserId: targetUser.id,
      targetMember,
      permission: 'ManageNicknames',
    });
    if (problem) {
      await ctx.reply(punishErrorCard(t, problem));
      return;
    }

    const eski = targetMember.nickname ?? targetUser.username;
    const reason = reasonText(ctx);
    try {
      await targetMember.setNickname(yeni, reason ?? 'Moderasyon: isim değişikliği');
    } catch {
      await ctx.reply(punishErrorCard(t, 'discord'));
      return;
    }

    await emitLog(ctx.guild, 'log_isim_degisiklik', {
      actor: ctx.user.id,
      actorTag: ctx.user.username ?? null,
      target: targetUser.id,
      targetTag: targetUser.username,
      reason,
      lines: [`Eski: **${eski}**`, `Yeni: **${yeni}**`, reason ? `Sebep: ${reason}` : null].filter(Boolean),
    }).catch(() => {});

    await ctx.reply(
      successTemplate(t('moderation.nickname.done_title'), [
        t('moderation.result.target', { kullanici: `<@${targetUser.id}>`, etiket: targetUser.username }),
        t('moderation.nickname.done_body', { yeni }),
      ]),
    );
  },
};
