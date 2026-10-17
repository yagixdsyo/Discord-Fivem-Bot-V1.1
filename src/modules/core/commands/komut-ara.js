/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, list as listTemplate } from '../../../ui/templates/index.js';
import { getGuildConfig } from '../../../core/guildSettings.js';

export default {
  name: 'komut-ara',
  aliases: ['command-search'],
  description: 'Komut adı/açıklama üzerinde V2 arama.',
  category: 'Bot',
  system: null,
  cooldown: 2,
  permission: { discord: [] },
  args: [{ name: 'query', type: 'rest', required: false, description: 'Aranacak ifade' }],
  async run(ctx) {
    const t = ctx.t;
    const query = String(ctx.args.query ?? '').toLowerCase().trim();
    const list = (ctx.registry?.commandList ?? []).filter((c) =>
      !query || c.name?.toLowerCase().includes(query) || c.description?.toLowerCase().includes(query)
    ).slice(0, 25);
    if (!list.length) {
      await ctx.reply(errorTemplate(t('advanced.search_empty_title'), [t('advanced.search_empty')]));
      return;
    }
    const prefixOnly = ctx.registry?.prefixOnly ?? new Set();
    let prefixChar = ctx.prefix ?? '.';
    if (ctx.source === 'slash' && ctx.guild) {
      const cfg = await getGuildConfig(ctx.guild.id).catch(() => null);
      prefixChar = cfg?.prefix ?? '.';
    }
    await ctx.reply(listTemplate({
      title: t('advanced.search_title'),
      lines: list.map((c) =>
        prefixOnly.has(c.name)
          ? `\`${prefixChar}${c.name}\` ${t('help.prefix_badge')} — ${c.description ?? ''}`
          : `\`/${c.name}\` — ${c.description ?? ''}`
      ),
    }));
  },
};
