/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from '../../../ui/templates/base.js';
import { error as errorTemplate } from '../../../ui/templates/index.js';
import { collectUserIds } from '../lib/bulkFlow.js';

export default {
  name: 'isim-değiştir-toplu',
  aliases: ['isimdegistirtoplu', 'topluisim'],
  description: 'Birden çok üyenin takma adını değiştirir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 10,
  permission: { discord: ['ManageNicknames'], node: 'moderation.isim' },
  args: [
    { name: 'isim', type: 'string', required: true, description: 'Yeni takma ad (tırnaklı tek parça)' },
    { name: 'kullanicilar', type: 'rest', required: true, description: 'Etiket veya id listesi' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const yeni = String(ctx.args.isim ?? '').trim().slice(0, 32);
    if (!yeni) {
      await ctx.reply(errorTemplate(t('moderation.nickname.empty_title'), [t('moderation.nickname.empty_body')]));
      return;
    }

    const ids = await collectUserIds(ctx, { rest: ctx.args.kullanicilar ?? null });
    if (ids.length === 0) {
      await ctx.reply(errorTemplate(t('moderation.bulk.empty_title'), [t('moderation.bulk.empty_body')]));
      return;
    }

    const ok = [];
    const yok = [];
    const hata = [];
    const me = ctx.guild.members.me;
    const actorIsOwner = ctx.guild.ownerId === ctx.user.id;

    for (const userId of ids) {
      let member = ctx.guild.members.cache.get(userId) ?? null;
      if (!member) member = await ctx.guild.members.fetch(userId).catch(() => null);
      if (!member) {
        yok.push(userId);
        continue;
      }
      if (
        userId === ctx.guild.ownerId ||
        (!actorIsOwner && ctx.member && member.roles.highest.position >= ctx.member.roles.highest.position) ||
        me.roles.highest.position <= member.roles.highest.position
      ) {
        hata.push(userId);
        continue;
      }
      try {
        await member.setNickname(yeni, 'Moderasyon: toplu isim değişikliği');
        ok.push(userId);
      } catch {
        hata.push(userId);
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    await ctx.reply(
      card({
        emojiKey: 'TOPLU',
        title: t('moderation.nickname.bulk_title', { isim: yeni }),
        lines: [
          t('moderation.bulk.ok', { adet: ok.length }),
          t('moderation.bulk.missing', { adet: yok.length }),
          t('moderation.bulk.failed', { adet: hata.length }),
          hata.length > 0
            ? t('moderation.bulk.failed_sample', { ornek: hata.slice(0, 5).map((id) => `\`${id}\``).join(', ') })
            : null,
        ].filter(Boolean),
        accent: hata.length > 0 ? 'warn' : 'success',
      }),
    );
  },
};
