/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';
import { PURGE_TYPES, purgeGuildData } from '../lib/privacy.js';

export default {
  name: 'veri-sil',
  aliases: ['verisil'],
  description: 'Mesaj/DM/destek kayıtlarını tür bazında kalıcı olarak siler.',
  category: 'Bot',
  system: null,
  cooldown: 30,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'tur', type: 'string', required: false, description: 'snipe|dmlog|bekleme|hepsi' },
    { name: 'onay', type: 'string', required: false, description: 'Onaylamak için SİL yazın' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const isGuildOwner = ctx.guild?.ownerId === ctx.user.id;
    const isAdmin = ctx.member?.permissions?.has?.('Administrator');
    if (!isGuildOwner && !isAdmin && !ctx.isOwner) {
      await ctx.reply(errorTemplate(t('veri.owner_only_title'), [t('veri.owner_only')]));
      return;
    }

    const tur = String(ctx.args.tur || '').toLowerCase().trim();
    const onay = String(ctx.args.onay || '').trim().toUpperCase();

    if (!tur) {
      await ctx.reply(
        listTemplate({
          title: t('veri.info_title'),
          lines: [
            t('veri.info_line_snipe'),
            t('veri.info_line_dmlog'),
            t('veri.info_line_bekleme'),
            t('veri.info_line_hepsi'),
            t('veri.info_usage'),
            t('veri.info_note'),
          ],
        }),
      );
      return;
    }

    if (tur !== 'hepsi' && !PURGE_TYPES.includes(tur)) {
      await ctx.reply(errorTemplate(t('veri.bad_type_title'), [t('veri.bad_type')]));
      return;
    }

    if (!['SİL', 'SIL'].includes(onay)) {
      await ctx.reply(errorTemplate(t('veri.confirm_need_title'), [t('veri.confirm_need')]));
      return;
    }

    const types = tur === 'hepsi' ? PURGE_TYPES : [tur];
    const counts = await purgeGuildData(ctx.guild, { types });

    await ctx.reply(
      success(t('veri.done_title'), [
        t('veri.done', { snipe: counts.snipe, dmlog: counts.dmlog, bekleme: counts.bekleme }),
      ]),
    );
  },
};
