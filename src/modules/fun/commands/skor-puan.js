/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { card, success } from '../../../ui/templates/index.js';
import { renderProfilePng } from '../../../ui/canvas/cards.js';
import { getColor } from '../../../ui/colors.js';

export default {
  name: 'skor-puan',
  aliases: ['skor-ver'],
  description: 'Kullaniciya oyun puani verir/alir.',
  category: 'Eglence',
  system: null,
  cooldown: 3,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Hedef kullanici' },
    { name: 'puan', type: 'number', required: true, description: 'Puan (negatif olabilir)' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const arg = ctx.args.kullanici;
    const target = arg?.user ?? arg;
    const delta = Number(ctx.args.puan) || 0;
    const { addScore, getScore, getTop } = await import('../lib/scoreboard.js');
    await addScore(ctx.guild.id, target.id, delta);
    const total = await getScore(ctx.guild.id, target.id);
    const rankRow = (await getTop(ctx.guild.id, 100)).find((row) => row.userId === target.id) ?? null;
    const line = t('fun.score_line', { kullanici: `<@${target.id}>`, puan: delta, toplam: total });

    const member =
      ctx.guild.members.cache.get(target.id) ??
      (await ctx.guild.members.fetch(target.id).catch(() => null));
    const fileName = `skor-${target.id}.png`;
    const png = await renderProfilePng({
      title: member?.displayName ?? target.username ?? target.id,
      subtitle: `@${target.username ?? target.id}`,
      avatarUrl: target.displayAvatarURL?.({ extension: 'png', size: 256 }) ?? null,
      stats: [
        { label: t('fun.score_label_delta'), value: delta >= 0 ? `+${delta}` : String(delta) },
        { label: t('fun.score_label_total'), value: String(total) },
        { label: t('fun.score_label_rank'), value: rankRow ? `#${rankRow.rank}` : '-' },
      ],
      accent: getColor('primary'),
    });

    if (png) {
      await ctx.reply(
        card({
          emojiKey: 'PUAN',
          title: t('fun.score_title'),
          lines: [line],
          accent: 'primary',
          imageUrls: [`attachment://${fileName}`],
          files: [new AttachmentBuilder(png, { name: fileName })],
        }),
      );
      return;
    }

    await ctx.reply(success(t('fun.score_title'), [line]));
  },
};
