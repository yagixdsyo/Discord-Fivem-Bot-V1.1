/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { scheduleTask } from '../lib/schedule.js';
import { addPunishment } from '../lib/store.js';
import {
  dmCard,
  ensureModerateAllowed,
  logPunishment,
  punishErrorCard,
  punishmentDmCard,
  reasonText,
} from '../lib/punishFlow.js';
import { punishmentResultPayload } from '../lib/view.js';

const DISCORD_TIMEOUT_MAX_MS = 28 * 86_400_000;

export default {
  name: 'mute',
  aliases: ['sustur'],
  description: 'Bir kullanıcıyı belirtilen süre boyunca susturur (timeout).',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  permission: { discord: ['ModerateMembers'], node: 'moderation.mute' },
  args: [
    { name: 'kullanici', type: 'member', required: true, description: 'Susturulacak üye' },
    { name: 'sure', type: 'duration', required: true, description: 'Süre (örn. 1sa, 3g) - en fazla 28 gün' },
    { name: 'sebep', type: 'rest', required: false, description: 'Susturma sebebi' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const targetMember = ctx.args.kullanici;
    const targetUser = targetMember.user;
    const durationMs = ctx.args.sure?.ms ?? null;

    const problem = await ensureModerateAllowed(ctx, {
      targetUserId: targetUser.id,
      targetMember,
    });
    if (problem) {
      await ctx.reply(punishErrorCard(t, problem));
      return;
    }

    if (!durationMs || durationMs > DISCORD_TIMEOUT_MAX_MS) {
      await ctx.reply(punishErrorCard(t, 'mute_max'));
      return;
    }

    const reason = reasonText(ctx);
    try {
      await targetMember.timeout(durationMs, reason ?? 'Moderasyon: susturma');
    } catch (error) {
      await ctx.reply(punishErrorCard(t, 'discord'));
      return;
    }

    const doc = await addPunishment({
      guildId: ctx.guild.id,
      userId: targetUser.id,
      userName: targetUser.username ?? null,
      type: 'mute',
      reason,
      actorId: ctx.user.id,
      actorTag: ctx.user.username ?? null,
      durationMs,
    });

    await scheduleTask({
      guildId: ctx.guild.id,
      kind: 'unmute',
      runAt: new Date(Date.now() + durationMs),
      payload: { guildId: ctx.guild.id, userId: targetUser.id, caseId: doc.case_id },
    }).catch(() => {});

    await logPunishment(ctx, {
      key: 'log_mute',
      targetUserId: targetUser.id,
      targetTag: targetUser.username,
      reason,
      lines: [`Süre: **${ctx.args.sure?.display ?? ''}**`, reason ? `Sebep: ${reason}` : null].filter(Boolean),
      accent: 'warn',
    });

    await dmCard(
      targetUser,
      punishmentDmCard(t, {
        emojiKey: 'MUTE',
        title: t('moderation.mute.dm_title', { sunucu: ctx.guild.name }),
        durationText: ctx.args.sure?.display ?? null,
        reason,
        guildName: ctx.guild.name,
      }),
    );

    await ctx.reply(
      punishmentResultPayload(t, {
        action: 'mute',
        userId: targetUser.id,
        userTag: targetUser.username,
        caseId: doc.case_id,
        reason,
        durationText: ctx.args.sure?.display ?? null,
      }),
    );
  },
};
