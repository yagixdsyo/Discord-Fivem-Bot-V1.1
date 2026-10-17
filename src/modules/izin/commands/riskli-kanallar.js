/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { success, list as listTemplate } from '../../../ui/templates/index.js';
import { scanChannels } from '../lib/permissions.js';

export default {
  name: 'riskli-kanallar',
  aliases: ['riskli-kanal'],
  description: 'Tehlikeli izin gecersiz kilmalarina sahip kanallari listeler.',
  category: 'Izin Dedektifi',
  system: 'izin',
  cooldown: 10,
  permission: { discord: ['Administrator'] },
  args: [],
  async run(ctx) {
    const t = ctx.t;
    const rows = scanChannels(ctx.guild).slice(0, 15);
    if (rows.length === 0) {
      await ctx.reply(success(t('izin.risky_empty_title'), [t('izin.risky_empty')]));
      return;
    }
    const lines = rows.map((row) => {
      const findings = row.findings.map((finding) => `\`${finding.flag}\`: ${finding.text}`).join('\n');
      return t('izin.risky_line', { kanal: `<#${row.channel.id}>`, puan: row.score, bulgular: findings });
    });
    await ctx.reply(listTemplate({
      title: t('izin.risky_title'),
      lines,
      footer: t('izin.risky_footer', { adet: rows.length }),
    }));
  },
};
