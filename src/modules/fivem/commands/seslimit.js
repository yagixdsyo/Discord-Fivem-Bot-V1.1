/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ChannelType } from 'discord.js';
import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { setVoiceLimit } from '../lib/voice.js';

export default {
  name: 'ses-limit',
  aliases: ['seslimit'],
  description: 'Bir ses kanalına kullanıcı limiti koyar (0 = limitsiz).',
  category: 'FiveM',
  system: null,
  cooldown: 3,
  permission: { discord: ['ManageChannels'] },
  args: [
    { name: 'limit', type: 'integer', required: true, description: 'Kullanıcı limiti (0-99)' },
    { name: 'kanal', type: 'voiceChannel', required: false, description: 'Kanal (boşsa bulunduğum kanal)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const channel = ctx.args.kanal ?? ctx.member?.voice?.channel ?? null;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await ctx.reply(errorTemplate(t('fivem.voice.not_in_voice_title'), [t('fivem.voice.not_in_voice')]));
      return;
    }

    const limit = Number(ctx.args.limit ?? 0);
    if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
      await ctx.reply(errorTemplate(t('fivem.voice.limit_invalid_title'), [t('fivem.voice.limit_invalid')]));
      return;
    }

    const result = await setVoiceLimit(channel, limit, { reason: `Ses limiti: ${ctx.user.id}` });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.voice.limit_fail_title'), [t('fivem.voice.limit_fail')]));
      return;
    }

    await ctx.reply(
      card({
        emojiKey: 'SES',
        title: t('fivem.voice.limit_title'),
        lines: [
          t('fivem.voice.limit_done', {
            kanal: `<#${channel.id}>`,
            limit: limit > 0 ? `**${limit}**` : t('fivem.rooms.unlimited'),
          }),
        ],
        accent: 'success',
      }),
    );
  },
};
