/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { moveMember } from '../lib/voice.js';

export default {
  name: 'belirli-sese-çek',
  aliases: ['belirli-sese-cek'],
  description: 'Belirtilen kullanıcıyı seçilen ses kanalına taşır.',
  category: 'FiveM',
  system: null,
  cooldown: 3,
  permission: { discord: ['MoveMembers'] },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Taşınacak kullanıcı' },
    { name: 'kanal', type: 'voiceChannel', required: true, description: 'Hedef ses kanalı' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const arg = ctx.args.kullanici;
    const targetId = arg?.user?.id ?? arg?.id;
    const member = ctx.guild.members.cache.get(targetId) ?? (await ctx.guild.members.fetch(targetId).catch(() => null));
    if (!member || member.user.bot) {
      await ctx.reply(errorTemplate(t('fivem.voice.member_missing_title'), [t('fivem.voice.member_missing')]));
      return;
    }
    if (!member.voice?.channelId) {
      await ctx.reply(errorTemplate(t('fivem.voice.target_not_in_voice_title'), [t('fivem.voice.target_not_in_voice', { kullanici: `<@${member.id}>` })]));
      return;
    }

    const channel = ctx.args.kanal;
    const result = await moveMember(member, channel.id, { reason: `Ses cekme: ${ctx.user.id}` });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.voice.move_fail_title'), [t('fivem.voice.move_fail')]));
      return;
    }

    await ctx.reply(
      card({
        emojiKey: 'SES',
        title: t('fivem.voice.move_title'),
        lines: [t('fivem.voice.moved_to', { kullanici: `<@${member.id}>`, kanal: `<#${channel.id}>` })],
        accent: 'success',
      }),
    );
  },
};
