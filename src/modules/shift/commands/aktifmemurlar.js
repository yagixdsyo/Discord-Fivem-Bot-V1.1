/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { error as errorTemplate, list as listTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { renderLeaderboardPng } from '../../../ui/canvas/cards.js';
import { getColor } from '../../../ui/colors.js';
import { button, row } from '../../../ui/v2.js';

export default {
  name: 'aktifmemurlar',
  aliases: ['aktif-status'],
  description: 'Su an mesaide olan memurlari ve surelerini listeler.',
  category: 'Mesai',
  system: 'mesai',
  cooldown: 5,
  permission: { discord: [] },
  args: [{ name: 'mesaikapat', type: 'boolean', required: false, description: 'Toplu cikar butonunu gizle' }],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/shifts.js');
    const rows = await lib.listActiveShifts(ctx.guild.id);
    if (!rows || !rows.length) {
      await ctx.reply(errorTemplate(t('shift.no_active_title'), [t('shift.no_active')]));
      return;
    }

    const now = Date.now();
    const durationOf = (row) => lib.formatDuration(Math.max(0, (now - new Date(row.started_at).getTime()) / 1000));

    const buttons = [];
    const canManage = ctx.member?.permissions?.has?.('ManageRoles');
    if (canManage && !ctx.args.mesaikapat) {
      buttons.push(
        row([
          button({
            id: `mesaibuton:toplu-cikar:${ctx.user.id}`,
            label: t('shift.bulk_end_button'),
            emojiKey: 'KILIT',
            style: 'danger',
          }),
        ]),
      );
    }

    const title = t('shift.active_list_title');
    const subtitle = t('shift.active_list_footer', { adet: rows.length });

    const items = await Promise.all(
      rows.slice(0, 12).map(async (entry) => {
        const member =
          ctx.guild.members.cache.get(entry.user_id) ??
          (await ctx.guild.members.fetch(entry.user_id).catch(() => null));
        return {
          name: member?.displayName ?? member?.user?.username ?? entry.user_id,
          valueText: durationOf(entry),
          avatarUrl: member?.user?.displayAvatarURL?.({ extension: 'png', size: 128 }) ?? null,
        };
      }),
    );

    const fileName = `aktifmemurlar-${ctx.guild.id}.png`;
    const png = await renderLeaderboardPng({
      title,
      subtitle,
      items,
      accent: getColor('primary'),
    });

    if (png) {
      await ctx.reply(
        card({
          emojiKey: 'MESAI',
          title,
          subtitle,
          accent: 'primary',
          buttons,
          imageUrls: [`attachment://${fileName}`],
          files: [new AttachmentBuilder(png, { name: fileName })],
        }),
      );
      return;
    }

    await ctx.reply(
      listTemplate({
        emojiKey: 'MESAI',
        title,
        lines: rows.map((entry) => `<@${entry.user_id}> - ${durationOf(entry)}`),
        footer: subtitle,
        extraRows: buttons,
      }),
    );
  },
};
