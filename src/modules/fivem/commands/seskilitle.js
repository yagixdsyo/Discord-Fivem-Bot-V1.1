/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ChannelType } from 'discord.js';
import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { lockVoiceChannel } from '../lib/voice.js';

export default {
  name: 'ses-kilitle',
  aliases: ['seskilitle'],
  description: 'Bir ses kanalına girişi kilitler veya açar.',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageChannels'] },
  args: [
    { name: 'kanal', type: 'voiceChannel', required: false, description: 'Kanal (boşsa bulunduğum kanal)' },
    {
      name: 'durum',
      type: 'choice',
      required: false,
      description: 'Kilit durumu (boşsa değiştirir)',
      choices: [
        { name: 'Kilitle', value: 'kilit' },
        { name: 'Aç', value: 'acik' },
      ],
    },
  ],

  async run(ctx) {
    const t = ctx.t;
    const channel = ctx.args.kanal ?? ctx.member?.voice?.channel ?? null;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await ctx.reply(errorTemplate(t('fivem.voice.not_in_voice_title'), [t('fivem.voice.not_in_voice')]));
      return;
    }

    const locked =
      ctx.args.durum === 'kilit' ? true : ctx.args.durum === 'acik' ? false : !channel.permissionsLocked;
    const result = await lockVoiceChannel(ctx.guild, channel, locked, { reason: `Ses kilidi: ${ctx.user.id}` });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.voice.lock_fail_title'), [t('fivem.voice.lock_fail')]));
      return;
    }

    await ctx.reply(
      card({
        emojiKey: locked ? 'KILIT' : 'KILIT_ACIK',
        title: t('fivem.voice.lock_title'),
        lines: [
          locked
            ? t('fivem.voice.locked', { kanal: `<#${channel.id}>` })
            : t('fivem.voice.unlocked', { kanal: `<#${channel.id}>` }),
        ],
        accent: locked ? 'warn' : 'success',
      }),
    );
  },
};
