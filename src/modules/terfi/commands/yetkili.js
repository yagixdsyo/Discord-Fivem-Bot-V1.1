/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { renderStaffPng } from '../../../ui/canvas/staff.js';
import { getColor } from '../../../ui/colors.js';

export default {
  name: 'yetkili',
  aliases: ['terfi'],
  description: 'Yetkili terfi durumunu ve istatistiklerini gösterir.',
  category: 'Yetkili',
  system: 'terfi',
  cooldown: 5,
  permission: { discord: [] },
  args: [{ name: 'kullanici', type: 'user', required: false, description: 'Bakılacak kullanıcı (boş: kendin)' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const arg = ctx.args.kullanici;
    const user = arg?.user ?? arg ?? ctx.user;
    const lib = await import('../lib/staff.js');
    const { progressBar } = await import('../lib/bar.js');

    const config = await lib.getStaffConfig(ctx.guild.id);
    const ladder = lib.buildLadder(config);
    const staff = await lib.getStaff(ctx.guild.id, user.id);
    const rank = lib.computeRank(staff.points, ladder);

    const board = await lib.staffLeaderboard(ctx.guild.id, { limit: 200 });
    const orderIndex = board.findIndex((row) => row.user_id === user.id);
    const member = await ctx.guild.members.fetch(user.id).catch(() => null);
    const displayName = member?.displayName ?? user.username ?? user.id;
    const avatarUrl = user.displayAvatarURL?.({ extension: 'png', size: 128 }) ?? null;

    const nextPoints = rank.next?.threshold ?? null;
    const ratio = rank.current ? (nextPoints ? staff.points / nextPoints : 1) : 0;

    const lines = [];
    if (!ladder.length) {
      lines.push(t('terfi.no_ladder'));
    } else if (rank.current) {
      lines.push(t('terfi.rank_line', { rutbe: `**${rank.current.name}**`, rol: `<@&${rank.current.roleId}>` }));
    } else {
      lines.push(t('terfi.rank_none'));
    }

    if (rank.next) {
      lines.push(
        t('terfi.progress_line', {
          bar: progressBar(staff.points, rank.next.threshold),
          puan: staff.points,
          hedef: rank.next.threshold,
          sonraki: rank.next.name,
        }),
      );
      lines.push(t('terfi.remaining_line', { kalan: Math.max(0, rank.next.threshold - staff.points) }));
    } else if (ladder.length) {
      lines.push(t('terfi.max_rank_line', { bar: progressBar(1, 1) }));
    }

    lines.push(t('terfi.tickets_line', { adet: staff.tickets ?? 0 }));
    lines.push(orderIndex >= 0 ? t('terfi.order_line', { sira: orderIndex + 1 }) : t('terfi.no_order'));

    const fileName = `yetkili-${user.id}.png`;
    const png = await renderStaffPng({
      title: t('terfi.card_title'),
      subtitle: displayName,
      avatarUrl,
      rankName: rank.current?.name ?? t('terfi.rank_none_short'),
      nextName: rank.next ? t('terfi.next_rank', { ad: rank.next.name }) : t('terfi.max_rank'),
      points: staff.points,
      nextPoints,
      ratio,
      stats: [
        { label: t('terfi.stat_points'), value: `${staff.points}` },
        { label: t('terfi.stat_tickets'), value: `${staff.tickets ?? 0}` },
        { label: t('terfi.stat_order'), value: orderIndex >= 0 ? `#${orderIndex + 1}` : '-' },
      ],
      footer: t('terfi.card_footer'),
      accent: rank.current ? getColor('primary') : null,
    });

    await ctx.reply(
      card({
        emojiKey: 'TERFI',
        title: t('terfi.card_title'),
        subtitle: displayName,
        lines,
        accent: rank.current ? 'primary' : 'info',
        imageUrls: png ? [`attachment://${fileName}`] : [],
        files: png ? [new AttachmentBuilder(png, { name: fileName })] : [],
        footer: t('terfi.card_footer'),
      }),
    );
  },
};
