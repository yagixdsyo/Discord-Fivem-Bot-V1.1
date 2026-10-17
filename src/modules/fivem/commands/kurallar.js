/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { StringSelectMenuBuilder, ActionRowBuilder } from 'discord.js';
import { error as errorTemplate } from '../../../ui/templates/index.js';
import { getRules } from '../lib/rules.js';
import { rulesPayload } from '../lib/view.js';

export function rulesSelectRow(t, pages) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('kurallar:sayfa')
      .setPlaceholder(t('fivem.rules.select_placeholder'))
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(pages.slice(0, 25).map((page, index) => ({ label: page.title.slice(0, 100), value: String(index) }))),
  );
}

export default {
  name: 'kurallar',
  aliases: ['kural'],
  description: 'Sunucu kurallarını sayfalı gösterir.',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: [] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    const pages = await getRules(ctx.guild.id).catch(() => []);
    if (!pages || pages.length === 0) {
      await ctx.reply(errorTemplate(t('fivem.rules.empty_title'), [t('fivem.rules.empty')]));
      return;
    }

    const selectRow = pages.length > 1 ? rulesSelectRow(t, pages) : null;
    await ctx.reply(rulesPayload(t, { pages, index: 0, selectRow }));
  },
};
