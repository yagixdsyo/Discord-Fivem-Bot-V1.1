/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { disabledCard } from '../../../ui/templates/base.js';
import { parsePageCustomId } from '../../../ui/paginator.js';
import { waitForInteraction, ensureMessage } from '../../setup/lib/interact.js';
import { LOG_CHANNELS } from '../../setup/lib/catalog.js';
import { readCounters } from '../lib/counters.js';
import { LOGSAY_PAGE_SIZE, logsayPayload, totalPages } from '../lib/view.js';

const NAME_BY_KEY = new Map(LOG_CHANNELS.map((channel) => [channel.key, channel.name]));

async function buildRows(guildId) {
  const counters = await readCounters(guildId);
  return [...counters.entries()]
    .map(([key, row]) => ({
      key,
      name: NAME_BY_KEY.get(key) ?? key,
      total: row.total,
      lastAt: row.lastAt,
    }))
    .filter((row) => row.total > 0 || row.lastAt > 0)
    .sort((a, b) => b.total - a.total);
}

export default {
  name: 'log-say',
  aliases: ['logsay', 'log-sayac'],
  description: 'Log kanallarının sayaçlarını ve son log zamanlarını gösterir.',
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
    let rows = await buildRows(ctx.guild.id);

    const build = () => logsayPayload(t, { page, ownerId, rows });

    let lastPayload = build();
    const message = await ensureMessage(ctx, await ctx.reply(lastPayload, { fetchReply: true }));
    if (!message || typeof message.awaitMessageComponent !== 'function') return;

    for (;;) {
      const interaction = await waitForInteraction(message, ownerId);
      if (!interaction) {
        await message.edit(disabledCard(lastPayload)).catch(() => {});
        return;
      }

      const parts = interaction.customId.split(':');

      if (parts[0] === 'ui' && parts[1] === 'pg') {
        const parsed = parsePageCustomId(interaction.customId);
        if (!parsed || parsed.namespace !== 'logsay') {
          await interaction.deferUpdate().catch(() => {});
          continue;
        }
        page = Math.min(Math.max(0, parsed.page), totalPages(rows.length, LOGSAY_PAGE_SIZE) - 1);
        lastPayload = build();
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      if (parts[0] === 'logsay' && parts[1] === 'yenile') {
        page = Math.min(
          Math.max(0, Number(parts[2]) || 0),
          totalPages(rows.length, LOGSAY_PAGE_SIZE) - 1,
        );
        rows = await buildRows(ctx.guild.id);
        lastPayload = build();
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      await interaction.deferUpdate().catch(() => {});
    }
  },
};
