/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { emitLog } from '../../logging/lib/emit.js';
import { getDonate, updateDonate } from '../lib/donate.js';

export default {
  name: 'donate-duzenle',
  aliases: ['donateduzenle', 'donate-düzenle'],
  description: 'Bir donate kaydının paketini, tutarını veya notunu günceller.',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'kayit', type: 'string', required: true, description: 'Kayıt kodu (d-...)' },
    { name: 'paket', type: 'string', required: false, description: 'Yeni paket adı' },
    { name: 'tutar', type: 'string', required: false, description: 'Yeni tutar (örn. 250 TL)' },
    { name: 'not', type: 'rest', required: false, description: 'Yeni not' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const key = String(ctx.args.kayit ?? '').trim();
    const doc = await getDonate(ctx.guild.id, key);
    if (!doc) {
      await ctx.reply(errorTemplate(t('fivem.donate.not_found_title'), [t('fivem.donate.not_found', { kod: key })]));
      return;
    }

    const paket = ctx.args.paket !== undefined && String(ctx.args.paket).trim() ? String(ctx.args.paket).trim() : undefined;
    const tutar = ctx.args.tutar !== undefined ? String(ctx.args.tutar).trim() : undefined;
    const not = ctx.args.not !== undefined ? String(ctx.args.not).trim() : undefined;

    if (paket === undefined && tutar === undefined && not === undefined) {
      await ctx.reply(errorTemplate(t('fivem.donate.edit_input_title'), [t('fivem.donate.edit_input')]));
      return;
    }

    const updated = await updateDonate(ctx.guild.id, doc.donate_id, { paket, amount: tutar, note: not });
    if (!updated) {
      await ctx.reply(errorTemplate(t('fivem.donate.edit_fail_title'), [t('fivem.donate.edit_fail')]));
      return;
    }

    const fresh = (await getDonate(ctx.guild.id, doc.donate_id)) ?? doc;

    await emitLog(ctx.guild, 'log_donate', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: fresh.user_id,
      targetTag: fresh.user_tag,
      lines: [
        t('fivem.donate.log_edited', { kullanici: `<@${fresh.user_id}>`, paket: `**${fresh.package}**`, kod: `\`${fresh.donate_id}\`` }),
        fresh.amount ? t('fivem.donate.amount_line', { tutar: `**${fresh.amount}**` }) : null,
        fresh.note ? t('fivem.donate.note_line', { not: fresh.note }) : null,
      ].filter(Boolean),
      accent: 'info',
    });

    await ctx.reply(
      card({
        emojiKey: 'DONATE',
        title: t('fivem.donate.edited_title'),
        lines: [
          t('fivem.donate.edited', { kullanici: `<@${fresh.user_id}>`, kod: `\`${fresh.donate_id}\`` }),
          t('fivem.donate.edited_package_line', { paket: `**${fresh.package}**` }),
          fresh.amount ? t('fivem.donate.amount_line', { tutar: `**${fresh.amount}**` }) : null,
          fresh.note ? t('fivem.donate.note_line', { not: fresh.note }) : null,
        ].filter(Boolean),
        accent: 'info',
        footer: `\`${fresh.donate_id}\``,
      }),
    );
  },
};
