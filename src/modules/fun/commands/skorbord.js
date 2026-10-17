/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { card, error as errorTemplate, list as listTemplate } from '../../../ui/templates/index.js';
import { renderLeaderboardPng } from '../../../ui/canvas/cards.js';
import { getColor } from '../../../ui/colors.js';

export default {
  name: 'skorbord',
  aliases: ['leaderboard'],
  description: 'Sunucu oyun puani lider tablosu.',
  category: 'Eglence',
  system: null,
  cooldown: 5,
  permission: { discord: [] },
  args: [],
  async run(ctx) {
    const t = ctx.t;
    const { getTop } = await import('../lib/scoreboard.js');
    const rows = await getTop(ctx.guild.id, 10);
    if (!rows.length) {
      await ctx.reply(errorTemplate(t('fun.leaderboard_empty_title'), [t('fun.leaderboard_empty')]));
      return;
    }

    const items = await Promise.all(
      rows.map(async (row) => {
        const member =
          ctx.guild.members.cache.get(row.userId) ??
          (await ctx.guild.members.fetch(row.userId).catch(() => null));
        return {
          name: member?.displayName ?? member?.user?.username ?? t('fun.leaderboard_unknown'),
          valueText: String(row.score),
          avatarUrl: member?.user?.displayAvatarURL?.({ extension: 'png', size: 128 }) ?? null,
        };
      }),
    );

    const fileName = `skorbord-${ctx.guild.id}.png`;
    const png = await renderLeaderboardPng({
      title: t('fun.leaderboard_title'),
      subtitle: t('fun.leaderboard_subtitle', { sayi: items.length }),
      items,
      accent: getColor('primary'),
    });

    if (png) {
      await ctx.reply(
        card({
          emojiKey: 'LEADERBOARD',
          title: t('fun.leaderboard_title'),
          subtitle: t('fun.leaderboard_subtitle', { sayi: items.length }),
          accent: 'primary',
          imageUrls: [`attachment://${fileName}`],
          files: [new AttachmentBuilder(png, { name: fileName })],
        }),
      );
      return;
    }

    const lines = rows.map((x, idx) => `${idx + 1}. <@${x.userId}> - ${x.score}`);
    await ctx.reply(listTemplate({ title: t('fun.leaderboard_title'), lines }));
  },
};
