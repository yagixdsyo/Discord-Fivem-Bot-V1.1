/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { disabledCard } from '../../../ui/templates/base.js';
import {
  confirm as confirmTemplate,
  error as errorTemplate,
  info as infoTemplate,
  warn as warnTemplate,
} from '../../../ui/templates/index.js';
import { runReset } from '../lib/engine.js';
import { ensureMessage, waitForInteraction } from '../lib/interact.js';
import { logToOwnerChannel } from '../lib/notify.js';
import { createDbStore } from '../lib/store.js';
import { resetSummaryPayload } from '../lib/view.js';

export default {
  name: 'sistem-sil',
  aliases: ['sistemsil', 'sunucu-sil'],
  description: 'Tüm kanalları, kategorileri ve rolleri siler (owner kanalı hariç).',
  category: 'Sistem',
  cooldown: 30,
  permission: { discord: ['Administrator'] },
  args: [
    {
      name: 'kanal',
      type: 'channel',
      required: false,
      description: 'Ek olarak korunacak kanal (owner kanalı zaten korunur)',
    },
  ],
  examples: ['/sistem-sil', '/sistem-sil kanal:#genel'],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const guild = ctx.guild;
    const ownerChannelId = ctx.config?.ownerLog?.channelId ?? null;
    const currentChannelId = ctx.interaction?.channelId ?? ctx.message?.channelId ?? null;
    const extraChannelId = ctx.args.kanal?.id ?? null;
    const keepChannelIds = [ownerChannelId, currentChannelId, extraChannelId].filter(Boolean);

    const totalChannels = guild.channels.cache.size;
    const totalRoles = guild.roles.cache.size;
    const keepMentions = keepChannelIds.map((id) => `<#${id}>`).join(' ') || '-';

    const confirmCard = confirmTemplate({
      title: t('setup.wipe.confirm_title'),
      description: [
        t('setup.wipe.confirm_body', { kanal: totalChannels, rol: totalRoles }),
        t('setup.wipe.protected_line', { kanallar: keepMentions }),
        t('setup.wipe.confirm_hint'),
      ],
      confirmId: `sistemsil:onay:${ctx.user.id}`,
      cancelId: `sistemsil:iptal:${ctx.user.id}`,
      confirmLabel: t('setup.wipe.confirm_label'),
      cancelLabel: t('setup.confirm.confirm_cancel'),
      danger: true,
    });

    const message = await ensureMessage(ctx, await ctx.reply(confirmCard, { fetchReply: true }));
    if (!message) return;

    const decision = await waitForInteraction(message, ctx.user.id);
    if (!decision || decision.customId !== `sistemsil:onay:${ctx.user.id}`) {
      const cancelled = warnTemplate(t('setup.cancel.title'), [t('setup.cancel.body')]);
      if (decision) await decision.update(cancelled).catch(() => {});
      else await message.edit(disabledCard(confirmCard)).catch(() => {});
      return;
    }

    await decision.update(infoTemplate(t('setup.wipe.progress_title'), [t('setup.wipe.progress_start')])).catch(() => {});

    const result = await runReset(guild, {
      store: createDbStore(),
      keepChannelIds,
      onProgress: async ({ index, total }) => {
        const line = t('setup.wipe.progress_line', { adim: `${Math.min(index + 1, total)}/${total}` });
        await message.edit(infoTemplate(t('setup.wipe.progress_title'), [line])).catch(() => {});
      },
    });

    await message.edit(resetSummaryPayload(t, result)).catch(() => {});
    logToOwnerChannel(
      ctx.config,
      infoTemplate(t('setup.wipe.log_title'), [
        t('setup.reset.done_counts', { kanal: result.deletedChannels, rol: result.deletedRoles }),
        t('setup.wipe.log_by', { kullanici: `<@${ctx.user.id}>` }),
      ]),
    ).catch(() => {});
  },
};
