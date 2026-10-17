/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { moveMember } from '../lib/voice.js';

export default {
  name: 'olduğum-sese-çek',
  aliases: ['oldugum-sese-cek'],
  description: 'Belirtilen kullanıcıyı, komutu kullananın bulunduğu ses kanalına taşır.',
  category: 'FiveM',
  system: null,
  cooldown: 3,
  permission: { discord: ['MoveMembers'] },
  args: [{ name: 'kullanici', type: 'user', required: true, description: 'Taşınacak kullanıcı' }],

  async run(ctx) {
    const t = ctx.t;
    const myChannel = ctx.member?.voice?.channel ?? null;
    if (!myChannel) {
      await ctx.reply(errorTemplate(t('fivem.voice.not_in_voice_title'), [t('fivem.voice.not_in_voice')]));
      return;
    }

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

    const result = await moveMember(member, myChannel.id, { reason: `Ses cekme: ${ctx.user.id}` });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.voice.move_fail_title'), [t('fivem.voice.move_fail')]));
      return;
    }

    await ctx.reply(
      card({
        emojiKey: 'SES',
        title: t('fivem.voice.move_title'),
        lines: [t('fivem.voice.moved_to_my', { kullanici: `<@${member.id}>`, kanal: `<#${myChannel.id}>` })],
        accent: 'success',
      }),
    );
  },
};
