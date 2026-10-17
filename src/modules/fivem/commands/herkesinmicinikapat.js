/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ChannelType } from 'discord.js';
import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { setChannelMute } from '../lib/voice.js';

export default {
  name: 'herkesin-micini-kapat',
  aliases: ['herkesinmicinikapat'],
  description: 'Bir ses kanalındaki herkesin sunucu mikrofonunu kapatır (siz hariç).',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['MuteMembers'] },
  args: [{ name: 'kanal', type: 'voiceChannel', required: false, description: 'Kanal (boşsa bulunduğum kanal)' }],

  async run(ctx) {
    const t = ctx.t;
    const channel = ctx.args.kanal ?? ctx.member?.voice?.channel ?? null;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await ctx.reply(errorTemplate(t('fivem.voice.not_in_voice_title'), [t('fivem.voice.not_in_voice')]));
      return;
    }

    const result = await setChannelMute(channel, true, {
      exemptIds: new Set([ctx.user.id]),
      reason: `Toplu mic kapatma: ${ctx.user.id}`,
    });

    await ctx.reply(
      card({
        emojiKey: 'MIC_KAPALI',
        title: t('fivem.voice.mute_all_title'),
        lines: [
          t('fivem.voice.mute_all_done', { kanal: `<#${channel.id}>`, adet: `**${result.changed}**`, hatali: `**${result.failed.length}**` }),
        ],
        accent: 'warn',
      }),
    );
  },
};
