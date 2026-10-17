/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, list as listTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';

export default {
  name: 'mesai-kanal',
  aliases: ['mesai-voices'],
  description: 'Mesai ses kanali listesini yonetir.',
  category: 'Mesai',
  system: 'mesai',
  cooldown: 3,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'islem', type: 'string', required: true, description: 'ekle|kaldir|liste' },
    { name: 'kanal', type: 'channel', required: false, description: 'Hedef kanal' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/shifts.js');
    const islem = String(ctx.args.islem || '').toLowerCase();
    if (islem === 'liste') {
      const rows = await lib.getAutoShiftVoiceChannels(ctx.guild.id);
      const lines = rows.length ? rows.map((id) => `<#${id}>`) : [t('mesai.voice_channel_empty')];
      await ctx.reply(listTemplate({ emojiKey: 'KANAL_SES', title: t('mesai.voice_channel_list_title'), lines }));
      return;
    }
    if (islem === 'ekle') {
      const ch = ctx.args.kanal?.id ?? ctx.args.kanal;
      if (!ch) {
        await ctx.reply(errorTemplate(t('mesai.voice_channel_need_title'), [t('mesai.voice_channel_need')]));
        return;
      }
      await lib.addAutoShiftVoiceChannel(ctx.guild.id, ch);
      await ctx.reply(
        card({
          emojiKey: 'KANAL_SES',
          title: t('mesai.voice_channel_added_title'),
          lines: [t('mesai.voice_channel_added', { kanal: `<#${ch}>` })],
          accent: 'success',
        }),
      );
      return;
    }
    if (islem === 'kaldir') {
      const ch = ctx.args.kanal?.id ?? ctx.args.kanal;
      if (!ch) {
        await ctx.reply(errorTemplate(t('mesai.voice_channel_need_title'), [t('mesai.voice_channel_need')]));
        return;
      }
      await lib.removeAutoShiftVoiceChannel(ctx.guild.id, ch);
      await ctx.reply(
        card({
          emojiKey: 'KANAL_SES',
          title: t('mesai.voice_channel_removed_title'),
          lines: [t('mesai.voice_channel_removed', { kanal: `<#${ch}>` })],
          accent: 'warn',
        }),
      );
      return;
    }
    await ctx.reply(errorTemplate(t('mesai.voice_channel_unknown_title'), [t('mesai.voice_channel_unknown')]));
  },
};
