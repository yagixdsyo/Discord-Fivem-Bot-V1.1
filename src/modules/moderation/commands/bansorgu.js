/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { disabledCard } from '../../../ui/templates/base.js';
import { error as errorTemplate, success as successTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { ensureMessage, waitForInteraction } from '../../setup/lib/interact.js';
import { logPunishment } from '../lib/punishFlow.js';
import { liftPunishment, listPunishments } from '../lib/store.js';
import { banQueryPayload } from '../lib/view.js';

export default {
  name: 'bansorgu',
  aliases: ['bansorgula'],
  description: 'Bir kullanıcının ban kaydını sorgular.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  permission: { discord: ['ModerateMembers'], node: 'moderation.sorgu' },
  args: [{ name: 'kullanici', type: 'user', required: true, description: 'Sorgulanacak kullanıcı' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const target = ctx.args.kullanici;
    const targetUser = target?.user ?? target;

    await emitLog(ctx.guild, 'log_sorgu', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: targetUser.id,
      targetTag: targetUser.username,
      lines: [t('moderation.query.sorgu_line', { tur: t('moderation.query.sorgu_ban') })],
      accent: 'info',
    });

    let doc =
      (await listPunishments(ctx.guild.id, { userId: targetUser.id, type: 'ban', active: true, limit: 1 }))[0] ?? null;
    if (!doc) {
      doc = (await listPunishments(ctx.guild.id, { userId: targetUser.id, type: 'ban', active: null, limit: 1 }))[0] ?? null;
    }
    if (!doc) {
      await ctx.reply(
        errorTemplate(t('moderation.query.not_found_title'), [t('moderation.query.not_found_body')]),
      );
      return;
    }

    const ownerId = ctx.user.id;
    let lastPayload = banQueryPayload(t, { doc, ownerId });
    const message = await ensureMessage(ctx, await ctx.reply(lastPayload, { fetchReply: true }));
    if (!message || typeof message.awaitMessageComponent !== 'function' || !doc.active) return;

    for (;;) {
      const interaction = await waitForInteraction(message, ownerId);
      if (!interaction) {
        await message.edit(disabledCard(lastPayload)).catch(() => {});
        return;
      }

      if (interaction.customId === `bansorgu:unban:${doc.case_id}:${ownerId}`) {
        const result = await liftPunishment(ctx.guild.id, doc.case_id, {
          actorId: ctx.user.id,
          reason: 'Ban sorgusu üzerinden açıldı',
        });
        if (!result.ok) {
          await interaction.deferUpdate().catch(() => {});
          continue;
        }
        await ctx.guild.bans.remove(targetUser.id, 'Ban sorgusu üzerinden açıldı').catch(() => {});
        await logPunishment(ctx, {
          key: 'log_unban',
          targetUserId: targetUser.id,
          targetTag: targetUser.username,
          lines: [`Ceza: \`${doc.case_id}\``, 'Ban sorgusu üzerinden açıldı.'],
          accent: 'success',
        });
        await interaction
          .update(successTemplate(t('moderation.query.unban_done_title'), [t('moderation.query.unban_done_body')]))
          .catch(() => {});
        return;
      }

      await interaction.deferUpdate().catch(() => {});
    }
  },
};
