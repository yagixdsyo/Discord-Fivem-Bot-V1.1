/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { error as errorTemplate, list as listTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { renderLeaderboardPng } from '../../../ui/canvas/cards.js';

export default {
  name: 'yetkili-zirve',
  aliases: ['terfi-zirve'],
  description: 'Yetkili puan sıralamasını canvas tabloyla gösterir.',
  category: 'Yetkili',
  system: 'terfi',
  cooldown: 10,
  permission: { discord: [] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const lib = await import('../lib/staff.js');
    const config = await lib.getStaffConfig(ctx.guild.id);
    const ladder = lib.buildLadder(config);
    const rows = await lib.staffLeaderboard(ctx.guild.id, { limit: 10 });

    if (!rows.length) {
      await ctx.reply(listTemplate({ title: t('terfi.zirve_title'), lines: [t('terfi.zirve_empty')] }));
      return;
    }

    const items = [];
    for (const row of rows) {
      const member = await ctx.guild.members.fetch(row.user_id).catch(() => null);
      const rank = lib.computeRank(row.points, ladder);
      items.push({
        name: member?.displayName ?? row.user_id,
        valueText: rank.current ? `${row.points} · ${rank.current.name}` : `${row.points} puan`,
        avatarUrl: member?.user?.displayAvatarURL?.({ extension: 'png', size: 64 }) ?? null,
      });
    }

    const fileName = 'yetkili-zirve.png';
    const png = await renderLeaderboardPng({
      title: t('terfi.zirve_title'),
      subtitle: t('terfi.zirve_sub', { adet: items.length }),
      items,
    });

    const lines = rows.map((row, index) => {
      const rank = lib.computeRank(row.points, ladder);
      return t('terfi.zirve_line', {
        sira: index + 1,
        kullanici: `<@${row.user_id}>`,
        puan: row.points,
        rutbe: rank.current ? rank.current.name : t('terfi.rank_none_short'),
      });
    });

    await ctx.reply(
      card({
        emojiKey: 'LEADERBOARD',
        title: t('terfi.zirve_title'),
        subtitle: t('terfi.zirve_sub', { adet: items.length }),
        lines,
        accent: 'primary',
        imageUrls: png ? [`attachment://${fileName}`] : [],
        files: png ? [new AttachmentBuilder(png, { name: fileName })] : [],
        footer: t('terfi.zirve_footer'),
      }),
    );
  },
};
