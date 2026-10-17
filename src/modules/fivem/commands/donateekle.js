/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { emitLog } from '../../logging/lib/emit.js';
import { addDonate } from '../lib/donate.js';

export default {
  name: 'donate-ekle',
  aliases: ['donateekle'],
  description: 'Bir kullanıcı için donate kaydı oluşturur.',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Donate yapan kullanıcı' },
    { name: 'paket', type: 'string', required: true, description: 'Paket adı' },
    { name: 'tutar', type: 'string', required: false, description: 'Tutar (örn. 250 TL)' },
    { name: 'not', type: 'rest', required: false, description: 'Not' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const arg = ctx.args.kullanici;
    const user = arg?.user ?? arg;
    const paket = String(ctx.args.paket ?? '').trim();
    if (!user || !paket) {
      await ctx.reply(errorTemplate(t('fivem.donate.input_missing_title'), [t('fivem.donate.input_missing')]));
      return;
    }

    const doc = await addDonate({
      guildId: ctx.guild.id,
      userId: user.id,
      userTag: user.username ?? null,
      paket,
      amount: ctx.args.tutar ? String(ctx.args.tutar).trim() : null,
      note: ctx.args.not ? String(ctx.args.not).trim() : null,
      actorId: ctx.user.id,
      actorTag: ctx.user.username,
    });

    await emitLog(ctx.guild, 'log_donate', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: user.id,
      targetTag: user.username,
      lines: [
        t('fivem.donate.log_added', {
          kullanici: `<@${user.id}>`,
          paket: `**${doc.package}**`,
          tutar: doc.amount ?? t('common.none'),
        }),
        doc.note ? t('fivem.donate.log_note', { not: doc.note }) : null,
      ].filter(Boolean),
      accent: 'success',
    });

    await ctx.reply(
      card({
        emojiKey: 'DONATE',
        title: t('fivem.donate.added_title'),
        lines: [
          t('fivem.donate.added', { kullanici: `<@${user.id}>`, paket: `**${doc.package}**`, kod: `\`${doc.donate_id}\`` }),
          doc.amount ? t('fivem.donate.amount_line', { tutar: `**${doc.amount}**` }) : null,
          doc.note ? t('fivem.donate.note_line', { not: doc.note }) : null,
        ].filter(Boolean),
        accent: 'success',
        footer: `\`${doc.donate_id}\``,
      }),
    );
  },
};
