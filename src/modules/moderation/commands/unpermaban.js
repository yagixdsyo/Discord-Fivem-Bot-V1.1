/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { liftActivePunishments } from '../lib/store.js';
import { logPunishment, punishErrorCard, reasonText } from '../lib/punishFlow.js';
import { punishmentResultPayload } from '../lib/view.js';

export default {
  name: 'unpermaban',
  aliases: ['kalici-ban-ac'],
  description: 'Bir kullanıcının kalıcı yasağını kaldırır.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  permission: { discord: ['BanMembers'], node: 'moderation.ban' },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Yasağı kaldırılacak kullanıcı' },
    { name: 'sebep', type: 'rest', required: false, description: 'Kaldırma sebebi' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const target = ctx.args.kullanici;
    const targetUser = target?.user ?? target;
    const reason = reasonText(ctx);

    const { lifted, cases } = await liftActivePunishments(ctx.guild.id, {
      userId: targetUser.id,
      types: ['ban'],
      permanent: true,
      actorId: ctx.user.id,
      reason: reason ?? 'Kalıcı yasak kaldırıldı',
    });

    if (lifted === 0) {
      await ctx.reply(punishErrorCard(t, 'no_active_perma'));
      return;
    }

    await ctx.guild.bans.remove(targetUser.id, reason ?? 'Kalıcı yasak kaldırıldı').catch(() => {});

    await logPunishment(ctx, {
      key: 'log_unban',
      targetUserId: targetUser.id,
      targetTag: targetUser.username,
      reason,
      lines: ['**Kalıcı yasak** kaldırıldı.', `Ceza: \`${cases[0]?.case_id ?? '-'}\``],
      accent: 'success',
    });

    await ctx.reply(
      punishmentResultPayload(t, {
        action: 'unban',
        userId: targetUser.id,
        userTag: targetUser.username,
        caseId: cases[0]?.case_id ?? null,
        reason,
        extraLines: [t('moderation.unpermaban.line')],
      }),
    );
  },
};
