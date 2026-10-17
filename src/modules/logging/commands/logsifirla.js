/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, warn as warnTemplate } from '../../../ui/templates/index.js';
import { disabledCard } from '../../../ui/templates/base.js';
import { waitForInteraction, ensureMessage } from '../../setup/lib/interact.js';
import { LOG_CHANNELS } from '../../setup/lib/catalog.js';
import { resetCounters } from '../lib/counters.js';
import { logResetConfirmPayload, logResetDonePayload } from '../lib/view.js';

function resolveKey(input) {
  if (!input) return null;
  const raw = String(input).trim();
  const lowered = raw.toLowerCase();
  return (
    LOG_CHANNELS.find((channel) => channel.key === raw) ??
    LOG_CHANNELS.find((channel) => channel.name.toLowerCase() === lowered) ??
    null
  );
}

export default {
  name: 'log-sıfırla',
  aliases: ['log-sifirla', 'logsifirla'],
  description: 'Log sayaçlarını sıfırlar (onay ister).',
  category: 'Log',
  cooldown: 10,
  permission: { discord: ['Administrator'] },
  args: [
    {
      name: 'kanal',
      type: 'string',
      required: false,
      description: 'Yalnızca bu log kanalının sayacını sıfırla (anahtar veya ad)',
    },
  ],
  examples: ['/log-sıfırla', '/log-sıfırla kanal:ban-log', '.log-sifirla cfx-wh-log'],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    let key = null;
    if (ctx.args.kanal) {
      const channel = resolveKey(ctx.args.kanal);
      if (!channel) {
        await ctx.reply(
          errorTemplate(t('loglar.not_found_title'), [t('loglar.not_found_body')]),
        );
        return;
      }
      key = channel.key;
    }

    const ownerId = ctx.user.id;
    const confirmCard = logResetConfirmPayload(t, { ownerId, key });
    const message = await ensureMessage(ctx, await ctx.reply(confirmCard, { fetchReply: true }));
    if (!message || typeof message.awaitMessageComponent !== 'function') return;

    const decision = await waitForInteraction(message, ownerId);
    if (!decision || decision.customId !== `logsifirla:onay:${ownerId}`) {
      const cancelled = warnTemplate(t('setup.cancel.title'), [t('setup.cancel.body')]);
      if (decision) await decision.update(cancelled).catch(() => {});
      else await message.edit(disabledCard(confirmCard)).catch(() => {});
      return;
    }

    const touched = await resetCounters(ctx.guild.id, key ? [key] : null);
    await decision
      .update(logResetDonePayload(t, { adet: key ? 1 : touched || LOG_CHANNELS.length }))
      .catch(() => {});
  },
};
