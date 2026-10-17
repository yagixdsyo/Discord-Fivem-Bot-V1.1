/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, progress } from '../../../ui/templates/index.js';
import { ensureMessage } from '../../setup/lib/interact.js';
import { collectTargets, dmUsageToday, getDailyLimit, progressPayload, startDmAnnounce } from './dmQueue.js';

/**
 * @param {object} ctx komut baglami
 * @param {{source: string, roleId?: string|null, userIds?: string[], sourceLabel: string, extraTargetIds?: string[]}} opts
 */
export async function runDmFlow(ctx, { source, roleId = null, userIds = [], sourceLabel }) {
  const t = ctx.t;

  let targets = await collectTargets(ctx.guild, { source, roleId, userIds });
  targets = [...new Set(targets)];

  if (targets.length === 0) {
    await ctx.reply(errorTemplate(t('announce.dm.no_targets_title'), [t('announce.dm.no_targets')]));
    return { ok: false, error: 'hedef_yok' };
  }

  const { limit, newBot } = await getDailyLimit(ctx.guild);
  const usage = await dmUsageToday(ctx.guild.id);
  const remaining = Math.max(0, limit - usage);

  if (remaining <= 0) {
    await ctx.reply(
      errorTemplate(t('announce.dm.limit_title'), [
        t('announce.dm.limit_reached', { limit: `**${limit}**`, kullanim: `**${usage}**` }),
      ]),
    );
    return { ok: false, error: 'limit' };
  }

  let trimmed = 0;
  if (targets.length > remaining) {
    trimmed = targets.length - remaining;
    targets = targets.slice(0, remaining);
  }

  const noteLines = [];
  if (trimmed > 0) noteLines.push(t('announce.dm.trim_note', { kirpilan: `**${trimmed}**`, kalan: `**${remaining}**` }));
  if (newBot) noteLines.push(t('announce.dm.new_bot_note', { limit: `**${limit}**` }));
  const note = noteLines.length ? noteLines.join('\n') : null;

  const senderTag = ctx.member?.displayName ?? ctx.user?.tag ?? ctx.user?.username ?? ctx.user?.id;

  const loading = await ctx.reply(
    progress({
      title: t('announce.dm.progress_title'),
      done: 0,
      total: targets.length,
      statusText: t('announce.dm.starting'),
      footer: senderTag,
      accent: 'primary',
      emojiKey: 'YUKLENIYOR',
    }),
  );
  const message = await ensureMessage(ctx, loading);

  const { jobId, total } = await startDmAnnounce({
    guild: ctx.guild,
    sender: ctx.user,
    targets,
    message: String(ctx.args.mesaj ?? ''),
    sourceLabel,
    channelId: message?.channelId ?? null,
    messageId: message?.id ?? null,
  });

  if (message?.edit) {
    await message
      .edit(progressPayload(t, { sent: 0, failed: 0, total, senderTag, jobId, note }))
      .catch(() => {});
  }

  return { ok: true, jobId, total, trimmed };
}
