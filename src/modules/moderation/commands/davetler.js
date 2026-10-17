/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { card } from '../../../ui/templates/index.js';
import { renderLeaderboardPng } from '../../../ui/canvas/cards.js';
import { getColor } from '../../../ui/colors.js';
import { inviteLeaderboard } from '../lib/invites.js';
import { inviteLeaderPayload } from '../lib/view.js';

export default {
  name: 'davetler',
  aliases: ['davet-top', 'davettop'],
  description: 'Davet liderlik tablosunu gösterir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  args: [{ name: 'gun', type: 'integer', required: false, description: 'Gün sayısı (varsayılan 30)' }],

  async run(ctx) {
    const t = ctx.t;
    const days = Math.min(Math.max(1, ctx.args.gun ?? 30), 90);
    const rows = await inviteLeaderboard(ctx.guild.id, { days, limit: 15 }).catch(() => []);
    if (!rows.length) {
      await ctx.reply(inviteLeaderPayload(t, { rows, days }));
      return;
    }

    const title = t('moderation.invite.leader_title');
    const subtitle = t('moderation.top.subtitle', { gun: days });
    const items = await Promise.all(
      rows.slice(0, 10).map(async (row) => {
        const member =
          ctx.guild.members.cache.get(row.inviter_id) ??
          (await ctx.guild.members.fetch(row.inviter_id).catch(() => null));
        return {
          name: member?.displayName ?? member?.user?.username ?? row.inviter_id,
          valueText: String(row.toplam),
          avatarUrl: member?.user?.displayAvatarURL?.({ extension: 'png', size: 128 }) ?? null,
        };
      }),
    );

    const fileName = `davetler-${ctx.guild.id}.png`;
    const png = await renderLeaderboardPng({ title, subtitle, items, accent: getColor('primary') });
    if (!png) {
      await ctx.reply(inviteLeaderPayload(t, { rows, days }));
      return;
    }

    await ctx.reply(
      card({
        emojiKey: 'LEADERBOARD',
        title,
        subtitle,
        accent: 'primary',
        imageUrls: [`attachment://${fileName}`],
        files: [new AttachmentBuilder(png, { name: fileName })],
      }),
    );
  },
};
