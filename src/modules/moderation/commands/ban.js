/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, warn as warnTemplate } from '../../../ui/templates/index.js';
import { countActiveWarnings, findActiveByUser } from '../lib/store.js';
import {
  applyBan,
  dmCard,
  ensureBanAllowed,
  logPunishment,
  punishErrorCard,
  punishmentDmCard,
  reasonText,
} from '../lib/punishFlow.js';
import { runConfirm } from '../lib/uiFlow.js';
import { banPreviewPayload, punishmentResultPayload } from '../lib/view.js';

export default {
  name: 'ban',
  aliases: [],
  description: 'Bir kullanıcıyı sunucudan yasaklar (isteğe bağlı süreli).',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  permission: { discord: ['BanMembers'], node: 'moderation.ban', rankLevel: 3 },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Yasaklanacak kullanıcı' },
    { name: 'sure', type: 'duration', required: false, description: 'Süre (örn. 2g, 12sa) - boşsa süresiz' },
    { name: 'sebep', type: 'rest', required: false, description: 'Yasak sebebi' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const arg = ctx.args.kullanici;
    const targetMember = arg?.roles ? arg : null;
    const targetUser = arg?.user ?? arg;

    const problem = await ensureBanAllowed(ctx, { targetUserId: targetUser.id, targetMember });
    if (problem) {
      await ctx.reply(punishErrorCard(t, problem));
      return;
    }

    const durationMs = ctx.args.sure?.ms ?? null;
    const durationText = ctx.args.sure?.display ?? null;
    const reason = reasonText(ctx);
    const ownerId = ctx.user.id;

    const warnCount = await countActiveWarnings(ctx.guild.id, targetUser.id).catch(() => 0);
    const activeList = await findActiveByUser(ctx.guild.id, targetUser.id).catch(() => []);

    const preview = banPreviewPayload(t, {
      userId: targetUser.id,
      userTag: targetUser.username,
      accountCreatedSec: Math.floor((targetUser.createdTimestamp ?? Date.now()) / 1000),
      warnCount,
      activeCount: activeList.length,
      durationText,
      reason,
      ownerId,
    });

    const confirmed = await runConfirm(ctx, {
      payload: preview,
      ownerId,
      confirmId: `banonay:${ownerId}`,
      cancelId: `baniptal:${ownerId}`,
      onCancel: () => warnTemplate(t('moderation.ban.cancelled_title'), [t('moderation.ban.cancelled_body')]),
    });
    if (!confirmed) return;

    const result = await applyBan(ctx, { targetUser, durationMs, permanent: false, reason });
    if (!result.ok) {
      await ctx.followUp(punishErrorCard(t, 'discord'));
      return;
    }

    await logPunishment(ctx, {
      key: 'log_ban',
      targetUserId: targetUser.id,
      targetTag: targetUser.username,
      reason,
      lines: [
        durationText ? `Süre: **${durationText}**` : 'Süre: **sınırsız**',
        reason ? `Sebep: ${reason}` : null,
      ].filter(Boolean),
    });

    await dmCard(
      targetUser,
      punishmentDmCard(t, {
        title: t('moderation.ban.dm_title', { sunucu: ctx.guild.name }),
        durationText,
        reason,
        guildName: ctx.guild.name,
      }),
    );

    await ctx.followUp(
      punishmentResultPayload(t, {
        action: 'ban',
        userId: targetUser.id,
        userTag: targetUser.username,
        caseId: result.doc.case_id,
        reason,
        durationText,
      }),
    );
  },
};
