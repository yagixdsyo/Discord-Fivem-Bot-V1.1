/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { disabledCard } from '../../../ui/templates/base.js';
import { getGuildConfig } from '../../../core/guildSettings.js';
import { parsePageCustomId } from '../../../ui/paginator.js';
import { waitForInteraction, ensureMessage } from '../../setup/lib/interact.js';
import { LOG_CHANNELS } from '../../setup/lib/catalog.js';
import { readCounters } from '../lib/counters.js';
import { setLogChannelEnabled } from '../lib/state.js';
import { LOGLAR_PAGE_SIZE, logDetailPayload, loglarListPayload, totalPages } from '../lib/view.js';

async function buildStates(guildId) {
  const [config, counters] = await Promise.all([getGuildConfig(guildId), readCounters(guildId)]);
  const disabled = new Set(
    Array.isArray(config?.settings?.['logs.disabled']) ? config.settings['logs.disabled'] : [],
  );
  const states = new Map();
  for (const channel of LOG_CHANNELS) {
    const row = counters.get(channel.key);
    states.set(channel.key, {
      enabled: !disabled.has(channel.key),
      total: row?.total ?? 0,
      lastAt: row?.lastAt ?? 0,
    });
  }
  return states;
}

function clampPage(page) {
  const pages = totalPages(LOG_CHANNELS.length, LOGLAR_PAGE_SIZE);
  return Math.min(Math.max(0, Number(page) || 0), pages - 1);
}

export default {
  name: 'loglar',
  aliases: ['log-listesi'],
  description: 'Log kanallarını listeler; durum gösterir ve açıp kapatmanızı sağlar.',
  category: 'Log',
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
    let page = 0;
    let states = await buildStates(ctx.guild.id);

    let lastPayload = loglarListPayload(t, { page, ownerId, states });
    const message = await ensureMessage(ctx, await ctx.reply(lastPayload, { fetchReply: true }));
    if (!message || typeof message.awaitMessageComponent !== 'function') return;

    for (;;) {
      const interaction = await waitForInteraction(message, ownerId);
      if (!interaction) {
        await message.edit(disabledCard(lastPayload)).catch(() => {});
        return;
      }

      const parts = interaction.customId.split(':');

      // Sayfalama
      if (parts[0] === 'ui' && parts[1] === 'pg') {
        const parsed = parsePageCustomId(interaction.customId);
        if (!parsed || parsed.namespace !== 'loglar') {
          await interaction.deferUpdate().catch(() => {});
          continue;
        }
        page = clampPage(parsed.page);
        lastPayload = loglarListPayload(t, { page, ownerId, states });
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      if (parts[0] !== 'loglar') {
        await interaction.deferUpdate().catch(() => {});
        continue;
      }

      const action = parts[1];

      if (action === 'sec') {
        page = clampPage(parts[2]);
        const key = interaction.values?.[0];
        const state = states.get(key);
        if (!state) {
          await interaction.deferUpdate().catch(() => {});
          continue;
        }
        lastPayload = logDetailPayload(t, { key, page, ownerId, state });
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      if (action === 'tgl') {
        const key = parts[2];
        page = clampPage(parts[3]);
        const state = states.get(key);
        if (state) {
          await setLogChannelEnabled(ctx.guild.id, key, !state.enabled);
          states = await buildStates(ctx.guild.id);
        }
        lastPayload = logDetailPayload(t, {
          key,
          page,
          ownerId,
          state: states.get(key) ?? { enabled: true, total: 0, lastAt: 0 },
        });
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      if (action === 'geri') {
        page = clampPage(parts[2]);
        lastPayload = loglarListPayload(t, { page, ownerId, states });
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      if (action === 'yenile') {
        page = clampPage(parts[2]);
        states = await buildStates(ctx.guild.id);
        lastPayload = loglarListPayload(t, { page, ownerId, states });
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      await interaction.deferUpdate().catch(() => {});
    }
  },
};
