/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';
import { analyzeOverwrites } from '../lib/permissions.js';

export default {
  name: 'izin-duzeltme-onizle',
  aliases: ['izinduzeltmeonizle'],
  description: 'Bir kanaldaki izin gecersiz kilmalari icin duzeltme onerileri cikarir.',
  category: 'Izin Dedektifi',
  system: 'izin',
  cooldown: 10,
  permission: { discord: ['Administrator'] },
  args: [{ name: 'kanal', type: 'channel', required: true, description: 'Incelenecek kanal' }],
  async run(ctx) {
    const t = ctx.t;
    const channel = ctx.args.kanal;
    if (!channel) {
      await ctx.reply(errorTemplate(t('izin.fix_invalid_title'), [t('izin.fix_invalid')]));
      return;
    }

    const suggestions = analyzeOverwrites(channel).slice(0, 10);
    if (suggestions.length === 0) {
      await ctx.reply(success(t('izin.fix_ok_title'), [t('izin.fix_ok', { kanal: `<#${channel.id}>` })]));
      return;
    }

    const lines = [t('izin.fix_target', { kanal: `<#${channel.id}>` })];
    for (const suggestion of suggestions) {
      lines.push(`**${suggestion.targetName}**`);
      for (const danger of suggestion.dangerousAllow) {
        lines.push(t('izin.fix_danger', { izin: danger.flag, puan: danger.weight, neden: danger.why }));
      }
      if (suggestion.redundantAllow) lines.push(t('izin.fix_redundant'));
    }

    await ctx.reply(listTemplate({
      title: t('izin.fix_title'),
      lines,
      footer: t('izin.fix_footer'),
    }));
  },
};
