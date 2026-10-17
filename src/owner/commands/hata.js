/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { findErrorByCode } from '../../core/errorHandler.js';
import { info, panel } from '../../ui/templates/index.js';

export default {
  name: 'hata',
  description: 'Hata kodunun detayını ve yığın izini gösterir.',
  category: 'Sistem',
  args: [{ name: 'kod', type: 'string', required: true, description: 'ERR-XXXXXX' }],

  async run(ctx) {
    const t = ctx.t;
    const code = String(ctx.args.kod ?? '').trim().toUpperCase();

    const entry = await findErrorByCode(code);
    if (!entry) {
      await ctx.reply(info(t('owner.error.not_found', { kod: code }), []));
      return;
    }

    const ts = Math.floor(new Date(entry.at ?? Date.now()).getTime() / 1000);
    const sections = [
      `**${t('owner.error.source')}:** ${entry.context?.source ?? '-'}`,
      `**${t('owner.error.guild')}:** ${entry.context?.guildId ?? '-'}`,
      `**${t('owner.error.user')}:** ${entry.context?.userId ?? '-'}`,
      `**${t('owner.error.command')}:** ${entry.context?.command ?? '-'}`,
      `**${t('owner.label_time')}:** <t:${ts}:f>`,
      `**${t('owner.error.message')}:** ${entry.message}`,
    ];

    if (entry.userMessage) sections.push(`**${t('owner.error.user_message')}:** ${entry.userMessage}`);
    if (entry.stack) sections.push('```\n' + String(entry.stack).slice(0, 1500) + '\n```');

    await ctx.reply(panel({ emojiKey: 'HATA', title: `Hata: ${entry.code}`, sections }));
  },
};
