/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { renderStaffPng } from '../../../ui/canvas/staff.js';
import { getColor } from '../../../ui/colors.js';
import { emitLog } from '../../logging/lib/emit.js';

export default {
  name: 'yetkili-puan',
  aliases: ['terfi-puan'],
  description: 'Yetkiliye manuel terfi puanı ekler veya çıkarır.',
  category: 'Yetkili',
  system: 'terfi',
  cooldown: 3,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Yetkili' },
    { name: 'puan', type: 'integer', required: true, description: 'Puan miktarı' },
    { name: 'islem', type: 'choice', required: false, choices: ['ekle', 'çıkar', 'cikar'], description: 'Ekle veya çıkar (varsayılan: ekle)' },
    { name: 'sebep', type: 'rest', required: false, description: 'Gerekçe (loglara işlenir)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const arg = ctx.args.kullanici;
    const user = arg?.user ?? arg;
    if (!user?.id) {
      await ctx.reply(errorTemplate(t('terfi.user_missing_title'), [t('terfi.user_missing')]));
      return;
    }

    const amount = Math.abs(Math.floor(Number(ctx.args.puan) || 0));
    if (!amount) {
      await ctx.reply(errorTemplate(t('terfi.amount_invalid_title'), [t('terfi.amount_invalid')]));
      return;
    }

    const islem = String(ctx.args.islem ?? 'ekle').toLocaleLowerCase('tr');
    const delta = islem.startsWith('ç') || islem.startsWith('c') ? -amount : amount;
    const sebep = String(ctx.args.sebep ?? '').trim() || t('terfi.reason_default');

    const lib = await import('../lib/staff.js');
    const { progressBar } = await import('../lib/bar.js');

    const config = await lib.getStaffConfig(ctx.guild.id);
    const staff = await lib.addStaffPoints(ctx.guild.id, user.id, delta);
    const sync = await lib.syncStaffRank({ guild: ctx.guild, userId: user.id, config });
    const ladder = lib.buildLadder(config);
    const rank = lib.computeRank(staff.points, ladder);

    if (sync.ok && sync.promoted) {
      await lib
        .announcePromotion({
          guild: ctx.guild,
          member: sync.member,
          rank: sync.current,
          next: sync.next,
          points: staff.points,
          config,
          t,
        })
        .catch(() => false);
    }

    await emitLog(ctx.guild, 'log_yetki_ver_al', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: user.id,
      targetTag: user.username ?? null,
      lines: [
        t('terfi.puan_log', { kullanici: `<@${user.id}>`, delta: delta > 0 ? `+${delta}` : `${delta}`, sebep }),
        t('terfi.puan_total', { puan: staff.points, adet: staff.tickets ?? 0 }),
      ],
      accent: delta > 0 ? 'success' : 'warn',
    }).catch(() => {});

    const lines = [
      t('terfi.puan_added', {
        kullanici: `<@${user.id}>`,
        delta: delta > 0 ? `+${delta}` : `${delta}`,
        sebep,
      }),
      t('terfi.puan_total', { puan: staff.points, adet: staff.tickets ?? 0 }),
    ];
    if (rank.next) {
      lines.push(
        t('terfi.progress_line', {
          bar: progressBar(staff.points, rank.next.threshold),
          puan: staff.points,
          hedef: rank.next.threshold,
          sonraki: rank.next.name,
        }),
      );
    }
    if (sync.ok && sync.promoted) lines.push(t('terfi.puan_promoted', { kullanici: `<@${user.id}>`, rutbe: `**${sync.current?.name}**` }));

    const member = sync.member ?? (await ctx.guild.members.fetch(user.id).catch(() => null));
    const displayName = member?.displayName ?? user.username ?? user.id;
    const fileName = `puan-${user.id}.png`;
    const png = await renderStaffPng({
      title: t('terfi.puan_card_title'),
      subtitle: displayName,
      avatarUrl: user.displayAvatarURL?.({ extension: 'png', size: 128 }) ?? null,
      rankName: rank.current?.name ?? t('terfi.rank_none_short'),
      nextName: rank.next ? t('terfi.next_rank', { ad: rank.next.name }) : t('terfi.max_rank'),
      points: staff.points,
      nextPoints: rank.next?.threshold ?? null,
      ratio: rank.next ? staff.points / rank.next.threshold : 1,
      stats: [
        { label: t('terfi.stat_points'), value: `${staff.points}` },
        { label: t('terfi.stat_tickets'), value: `${staff.tickets ?? 0}` },
      ],
      footer: t('terfi.puan_card_footer'),
      accent: delta > 0 ? getColor('success') : getColor('warn'),
    });

    await ctx.reply(
      card({
        emojiKey: 'TERFI',
        title: t('terfi.puan_card_title'),
        subtitle: displayName,
        lines,
        accent: delta > 0 ? 'success' : 'warn',
        imageUrls: png ? [`attachment://${fileName}`] : [],
        files: png ? [new AttachmentBuilder(png, { name: fileName })] : [],
        footer: t('terfi.puan_card_footer'),
      }),
    );
  },
};
