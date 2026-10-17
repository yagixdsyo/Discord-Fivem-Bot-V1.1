/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from '../../../ui/templates/base.js';
import { getChannelId } from '../lib/maps.js';

export default {
  name: 'üye-yardım',
  aliases: ['uye-yardim', 'uyeyardim'],
  description: 'Oyuncular için hızlı yardım rehberini gösterir.',
  category: 'FiveM',
  system: null,
  cooldown: 10,
  permission: { discord: [] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    const rules = await getChannelId(ctx.guild.id, 'kurallar').catch(() => null);
    const panel = await getChannelId(ctx.guild.id, 'panel_sikayet').catch(() => null);

    await ctx.reply(
      card({
        emojiKey: 'BILGI',
        title: t('fivem.help.title', { sunucu: ctx.guild.name }),
        lines: [
          t('fivem.help.intro'),
          t('fivem.help.rules', { kanal: rules ? `<#${rules}>` : t('fivem.help.rules_channel') }),
          t('fivem.help.whitelist'),
          t('fivem.help.support'),
          t('fivem.help.complaint', { kanal: panel ? `<#${panel}>` : t('fivem.help.complaint_channel') }),
          t('fivem.help.donate'),
          t('fivem.help.footer'),
        ],
        accent: 'info',
      }),
    );
  },
};
