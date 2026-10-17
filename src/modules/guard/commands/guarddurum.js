/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { disabledCard } from '../../../ui/templates/base.js';
import { error as errorTemplate, warn as warnTemplate } from '../../../ui/templates/index.js';
import { ensureMessage, waitForInteraction } from '../../setup/lib/interact.js';
import { getGuardConfig, setGuardModuleSetting } from '../lib/config.js';
import { guardModulePayload, guardStatusPayload } from '../lib/view.js';

export default {
  name: 'guard-durum',
  aliases: ['guarddurum'],
  description: 'Guard koruma modüllerinin durumunu gösterir (aç/kapat).',
  category: 'Guard',
  system: 'guard',
  cooldown: 5,
  permission: { discord: ['Administrator'] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const ownerId = ctx.user.id;
    let config = await getGuardConfig(ctx.guild.id);
    let lastPayload = guardStatusPayload(t, { config, ownerId });

    const message = await ensureMessage(ctx, await ctx.reply(lastPayload, { fetchReply: true }));
    if (!message || typeof message.awaitMessageComponent !== 'function') return;

    while (true) {
      const interaction = await waitForInteraction(message, ownerId);
      if (!interaction) {
        await message.edit(disabledCard(lastPayload)).catch(() => {});
        return;
      }

      const id = interaction.customId;

      if (id === `guarddurum:kapat:${ownerId}`) {
        await interaction.update(disabledCard(lastPayload)).catch(() => {});
        return;
      }

      if (id === `guarddurum:yenile:${ownerId}`) {
        config = await getGuardConfig(ctx.guild.id, { fresh: true });
        lastPayload = guardStatusPayload(t, { config, ownerId });
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      if (id.startsWith(`guarddurum:sec:${ownerId}`)) {
        const moduleKey = interaction.values?.[0];
        lastPayload = guardModulePayload(t, { config, moduleKey, ownerId });
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      if (id.startsWith(`guarddurum:tgl:`) && id.endsWith(`:${ownerId}`)) {
        const parts = id.split(':');
        const moduleKey = parts[2];
        const cfg = config.modules[moduleKey];
        if (!cfg) {
          await interaction.deferUpdate().catch(() => {});
          continue;
        }
        const result = await setGuardModuleSetting(ctx.guild.id, moduleKey, { enabled: !cfg.enabled });
        config = await getGuardConfig(ctx.guild.id, { fresh: true });
        lastPayload = result.ok
          ? guardModulePayload(t, { config, moduleKey, ownerId })
          : warnTemplate(t('guard.ayar.failed_title'), [t('guard.ayar.failed_body')]);
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      if (id === `guarddurum:geri:${ownerId}`) {
        lastPayload = guardStatusPayload(t, { config, ownerId });
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      await interaction.deferUpdate().catch(() => {});
    }
  },
};
