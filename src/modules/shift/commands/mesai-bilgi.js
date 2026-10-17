/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { card, success } from '../../../ui/templates/index.js';
import { renderProfilePng } from '../../../ui/canvas/cards.js';
import { getColor } from '../../../ui/colors.js';

export default {
  name: 'mesai-bilgi',
  aliases: ['mesai-status'],
  description: 'Bir kullanicinin mesai bilgisini gosterir.',
  category: 'Mesai',
  system: 'mesai',
  cooldown: 5,
  permission: { discord: [] },
  args: [{ name: 'kullanici', type: 'user', required: false, description: 'Hedef kullanici (varsayilan kendisi)' }],
  async run(ctx) {
    const t = ctx.t;
    const arg = ctx.args.kullanici;
    const target = arg?.user ?? arg ?? ctx.user;
    const lib = await import('../lib/shifts.js');
    const active = await lib.findActiveShift(ctx.guild.id, target.id);
    const total = await lib.shiftTotalSeconds(ctx.guild.id, target.id);
    const onLeave = await lib.isOnLeave(ctx.guild.id, target.id);

    const lines = [
      t('shift.info_user', { kullanici: `<@${target.id}>` }),
      active
        ? t('shift.info_active', { since: `<t:${Math.floor(new Date(active.started_at).getTime() / 1000)}:R>` })
        : t('shift.info_inactive'),
      t('shift.info_total', { sure: lib.formatDuration(total) }),
      t('shift.info_leave', { durum: onLeave ? t('shift.on_leave') : t('shift.not_on_leave') }),
    ];

    const member =
      ctx.guild.members.cache.get(target.id) ??
      (await ctx.guild.members.fetch(target.id).catch(() => null));
    const fileName = `mesai-${target.id}.png`;
    const png = await renderProfilePng({
      title: member?.displayName ?? target.username ?? target.id,
      subtitle: t('shift.info_user', { kullanici: `@${target.username ?? target.id}` }),
      avatarUrl: target.displayAvatarURL?.({ extension: 'png', size: 256 }) ?? null,
      stats: [
        { label: t('shift.info_active_label'), value: active ? t('shift.info_active_short') : t('shift.info_inactive_short') },
        { label: t('shift.info_total_label'), value: lib.formatDuration(total) },
        { label: t('shift.info_leave_label'), value: onLeave ? t('shift.on_leave') : t('shift.not_on_leave') },
      ],
      accent: getColor('primary'),
    });

    if (png) {
      await ctx.reply(
        card({
          emojiKey: 'MESAI',
          title: t('shift.info_title'),
          lines: [`**${member?.displayName ?? target.username ?? target.id}** — <@${target.id}>`],
          accent: 'primary',
          imageUrls: [`attachment://${fileName}`],
          files: [new AttachmentBuilder(png, { name: fileName })],
          footer: active
            ? t('shift.info_active', { since: `<t:${Math.floor(new Date(active.started_at).getTime() / 1000)}:R>` })
            : t('shift.info_inactive'),
        }),
      );
      return;
    }

    await ctx.reply(success(t('shift.info_title'), lines));
  },
};
