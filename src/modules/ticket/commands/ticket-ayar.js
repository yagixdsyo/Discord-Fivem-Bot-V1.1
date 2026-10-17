/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { createTranslator } from '../../../locales/index.js';

export default {
  name: 'ticket-ayar',
  aliases: [],
  description: 'Ticket ayarlarini (staff roller, kanal kategorisi, yeniden acma, uye kapatabilme) gosterir.',
  category: 'Ticket',
  system: 'ticket',
  cooldown: 10,
  permission: { discord: ['ManageGuild'] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    const cfgLib = await import('../lib/config.js');
    const cfg = await cfgLib.getTicketConfig(ctx.guild.id);
    const lines = [
      t('ticket.config_staff', { roller: (cfg.staffRoles ?? []).map((r) => `<@&${r}>`).join(', ') || '-' }),
      t('ticket.config_category', { kategori: cfg.ticketCategoryId ? `<#${cfg.ticketCategoryId}>` : '-' }),
      t('ticket.config_name', { sablon: cfg.nameTemplate ?? '-' }),
      t('ticket.config_reopen', { deger: cfg.memberCloseReopen ? t('common.yes') : t('common.no') }),
      t('ticket.config_member_close', { deger: cfg.allowMemberClose ? t('common.yes') : t('common.no') }),
    ];
    await ctx.reply(success(t('ticket.config_title'), lines));
  },
};
