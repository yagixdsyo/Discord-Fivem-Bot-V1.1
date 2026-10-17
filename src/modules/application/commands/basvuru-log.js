/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';

export default {
  name: 'basvuru-log',
  aliases: [],
  description: 'Basvuru log kanalini ayarlar.',
  category: 'Basvuru',
  system: 'basvuru',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [{ name: 'kanal', type: 'channel', required: true, description: 'Log kanali' }],
  async run(ctx) {
    const t = ctx.t;
    const { setSetting } = await import('../../fivem/lib/state.js');
    const kanal = ctx.args.kanal;
    const ch = kanal?.id ?? kanal;
    if (!ch) {
      await ctx.reply(errorTemplate(t('basvuru_log.invalid_title'), [t('basvuru_log.invalid')]));
      return;
    }
    const { getGuildConfig } = await import('../../../core/guildSettings.js');
    await setSetting(ctx.guild.id, 'application.logChannelId', ch);
    await ctx.reply(success(t('basvuru_log.saved_title'), [t('basvuru_log.saved', { kanal: `<#${ch}>` })]));
  },
};
