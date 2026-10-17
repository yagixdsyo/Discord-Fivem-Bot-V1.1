/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { button, row } from '../../../ui/v2.js';

export default {
  name: 'cekilis',
  aliases: ['cekilis-baslat'],
  description: 'Cekilis kur, bitir, iptal, listele.',
  category: 'Etkinlik',
  system: 'cekilis',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'islem', type: 'string', required: true, description: 'baslat|bitir|iptal|liste' },
    { name: 'odul', type: 'string', required: false, description: 'Odul' },
    { name: 'sure', type: 'number', required: false, description: 'Sure (dakika)' },
    { name: 'kazanan', type: 'number', required: false, description: 'Kazanan sayisi' },
    { name: 'cekilisId', type: 'string', required: false, description: 'Cekilis ID' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/giveaways.js');
    const islem = String(ctx.args.islem || '').toLowerCase();
    if (islem === 'liste') {
      const rows = await lib.listGiveaways(ctx.guild.id);
      const lines = rows.map((g) => `${g.giveaway_id} — ${g.award} — ${g.status} — <t:${Math.floor(new Date(g.ends_at).getTime() / 1000)}:R>`);
      await ctx.reply(listTemplate({ title: t('giveaway.list_title'), lines: lines.length ? lines : [t('giveaway.list_empty')] }));
      return;
    }
    if (islem === 'baslat') {
      const award = String(ctx.args.odul ?? ctx.args.baslik ?? 'Oyuncu Eqibi').trim();
      const minutes = Math.max(1, Math.min(1440, Number(ctx.args.sure) || 10));
      const winnerCount = Math.max(1, Math.min(20, Number(ctx.args.kazanan) || 1));
      const endsAt = new Date(Date.now() + minutes * 60000);
      const doc = await lib.createGiveaway({ guildId: ctx.guild.id, creatorId: ctx.user.id, award, endsAt, winnerCount });
      const panel = card({
        emojiKey: 'CEKILIS',
        title: t('giveaway.started_title'),
        lines: [t('giveaway.started', { odul: award, bitis: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>` })],
        accent: 'primary',
        buttons: [row([button({ id: `cekilis:katil:${doc.giveaway_id}`, label: t('giveaway.join_button'), emojiKey: 'YILDIZ', style: 'primary' })])],
      });
      const message = await ctx.channel.send(panel);
      await ctx.reply(success(t('giveaway.created_title'), [t('giveaway.created', { id: doc.giveaway_id })]));
      setTimeout(() => {
        lib.finalizeGiveaway(ctx.client, ctx.guild.id, doc.giveaway_id).then((winners) => {
          const text = winners?.length ? winners.map((w) => `<@${w}>`).join(', ') : t('giveaway.no_winner');
          message.channel.send(card({
            emojiKey: 'CEKILIS',
            title: t('giveaway.ended_title'),
            lines: [t('giveaway.ended_line', { odul: award, kazanan: text })],
            accent: 'success',
          })).catch(() => {});
        }).catch(() => {});
      }, minutes * 60000);
      return;
    }
    if (islem === 'bitir') {
      const id = String(ctx.args.cekilisId || ctx.args.odul || '').trim();
      const winners = await lib.finalizeGiveaway(ctx.client, ctx.guild.id, id);
      await ctx.reply(success(t('giveaway.finished_title'), [t('giveaway.finished', { kazanan: winners?.map((w) => `<@${w}>`).join(', ') || t('giveaway.no_winner') })]));
      return;
    }
    if (islem === 'iptal') {
      const id = String(ctx.args.cekilisId || ctx.args.odul || '').trim();
      const lib2 = await import('../lib/giveaways.js');
      await lib2.updateGiveaway?.(ctx.guild.id, id, { status: 'iptal' }).catch(() => {});
      // collection direct update via store lib if helper not there
      const { updateDoc } = await import('../../fivem/lib/store.js');
      await updateDoc('giveaways', { guild_id: ctx.guild.id, giveaway_id: id }, { status: 'iptal' });
      await ctx.reply(success(t('giveaway.cancelled_title'), [t('giveaway.cancelled', { id })]));
      return;
    }
    await ctx.reply(errorTemplate(t('giveaway.bad_action_title'), [t('giveaway.bad_action')]));
  },
};
