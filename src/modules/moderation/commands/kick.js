/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, warn as warnTemplate } from '../../../ui/templates/index.js';
import { confirm as confirmTemplate } from '../../../ui/templates/index.js';
import { addPunishment } from '../lib/store.js';
import {
  dmCard,
  ensurePunishAllowed,
  logPunishment,
  punishErrorCard,
  punishmentDmCard,
  reasonText,
} from '../lib/punishFlow.js';
import { runConfirm } from '../lib/uiFlow.js';
import { punishmentResultPayload } from '../lib/view.js';

export default {
  name: 'kick',
  aliases: ['at'],
  description: 'Bir üyeyi sunucudan atar.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  permission: { discord: ['KickMembers'], node: 'moderation.kick' },
  args: [
    { name: 'kullanici', type: 'member', required: true, description: 'Atılacak üye' },
    { name: 'sebep', type: 'rest', required: false, description: 'Atılma sebebi' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const targetMember = ctx.args.kullanici;
    const targetUser = targetMember.user;

    const problem = await ensurePunishAllowed(ctx, {
      targetUserId: targetUser.id,
      targetMember,
      permission: 'KickMembers',
    });
    if (problem) {
      await ctx.reply(punishErrorCard(t, problem));
      return;
    }

    const reason = reasonText(ctx);
    const ownerId = ctx.user.id;

    const preview = confirmTemplate({
      title: t('moderation.kick.preview_title'),
      description: [
        t('moderation.result.target', { kullanici: `<@${targetUser.id}>`, etiket: targetUser.username }),
        reason ? t('moderation.result.reason', { sebep: reason }) : null,
      ].filter(Boolean),
      confirmId: `kickonay:${ownerId}`,
      cancelId: `kickiptal:${ownerId}`,
      confirmLabel: t('moderation.kick.confirm'),
      danger: true,
    });

    const confirmed = await runConfirm(ctx, {
      payload: preview,
      ownerId,
      confirmId: `kickonay:${ownerId}`,
      cancelId: `kickiptal:${ownerId}`,
      onCancel: () => warnTemplate(t('moderation.kick.cancelled_title'), [t('moderation.kick.cancelled_body')]),
    });
    if (!confirmed) return;

    try {
      await targetMember.kick(reason ?? 'Moderasyon: atıldı');
    } catch {
      await ctx.followUp(punishErrorCard(t, 'discord'));
      return;
    }

    const doc = await addPunishment({
      guildId: ctx.guild.id,
      userId: targetUser.id,
      userName: targetUser.username ?? null,
      type: 'kick',
      reason,
      actorId: ctx.user.id,
      actorTag: ctx.user.username ?? null,
      active: false,
    });

    await logPunishment(ctx, {
      key: 'log_kick',
      targetUserId: targetUser.id,
      targetTag: targetUser.username,
      reason,
      lines: [reason ? `Sebep: ${reason}` : null].filter(Boolean),
    });

    await dmCard(
      targetUser,
      punishmentDmCard(t, {
        emojiKey: 'KICK',
        title: t('moderation.kick.dm_title', { sunucu: ctx.guild.name }),
        durationText: null,
        reason,
        guildName: ctx.guild.name,
      }),
    );

    await ctx.followUp(
      punishmentResultPayload(t, {
        action: 'kick',
        userId: targetUser.id,
        userTag: targetUser.username,
        caseId: doc.case_id,
        reason,
      }),
    );
  },
};
