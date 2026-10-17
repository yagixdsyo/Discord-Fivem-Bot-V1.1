/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';

const IMAGE_URL_RE = /^https?:\/\/\S+$/i;
const RESET_WORDS = new Set(['sıfırla', 'sifirla', 'reset', 'temizle']);

export default {
  name: 'bot',
  aliases: ['botprofil'],
  description: 'Botun sunucudaki ismini ve avatarini yonetir.',
  category: 'Bot',
  system: null,
  cooldown: 10,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'islem', type: 'string', required: true, description: 'isim | avatar | sifirla' },
    { name: 'deger', type: 'rest', required: false, description: 'Yeni isim veya gorsel baglantisi' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const islem = String(ctx.args.islem ?? '').trim().toLowerCase();
    const deger = String(ctx.args.deger ?? '').trim();

    if (islem === 'isim' || islem === 'nick' || islem === 'nickname') {
      if (!deger) {
        await ctx.reply(errorTemplate(t('bot.input_missing_title'), [t('bot.input_missing')]));
        return;
      }
      const me = await ctx.guild.members.fetchMe().catch(() => null);
      if (!me) {
        await ctx.reply(errorTemplate(t('bot.fail_title'), [t('bot.fail')]));
        return;
      }
      const result = await me.setNickname(deger.slice(0, 32)).catch((err) => err);
      if (result instanceof Error) {
        await ctx.reply(errorTemplate(t('bot.fail_title'), [t('bot.fail')]));
        return;
      }
      await ctx.reply(success(t('bot.nick_ok_title'), [t('bot.nick_ok', { isim: deger })]));
      return;
    }

    if (islem === 'avatar') {
      if (!deger || !IMAGE_URL_RE.test(deger)) {
        await ctx.reply(errorTemplate(t('bot.avatar_invalid_title'), [t('bot.avatar_invalid')]));
        return;
      }
      const result = await ctx.client.user.setAvatar(deger).catch((err) => err);
      if (result instanceof Error) {
        const limited = result?.status === 429 || /rate.?limit/i.test(String(result?.message ?? ''));
        await ctx.reply(errorTemplate(t('bot.fail_title'), [limited ? t('bot.rate_limit') : t('bot.fail')]));
        return;
      }
      await ctx.reply(success(t('bot.avatar_ok_title'), [t('bot.avatar_ok')]));
      return;
    }

    if (RESET_WORDS.has(islem)) {
      const me = await ctx.guild.members.fetchMe().catch(() => null);
      if (!me) {
        await ctx.reply(errorTemplate(t('bot.fail_title'), [t('bot.fail')]));
        return;
      }
      const result = await me.setNickname(null).catch((err) => err);
      if (result instanceof Error) {
        await ctx.reply(errorTemplate(t('bot.fail_title'), [t('bot.fail')]));
        return;
      }
      await ctx.reply(success(t('bot.nick_reset_title'), [t('bot.nick_reset')]));
      return;
    }

    await ctx.reply(errorTemplate(t('bot.unknown_title'), [t('bot.unknown')]));
  },
};
