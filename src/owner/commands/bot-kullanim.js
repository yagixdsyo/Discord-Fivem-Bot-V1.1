/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { usageReport } from '../../core/usageStats.js';
import { info as infoTemplate, panel } from '../../ui/templates/index.js';
import { footerLine } from '../../ui/v2.js';

function renderWindow(t, label, stats) {
  if (!stats || stats.total === 0) return `**${t('owner.usage.window', { pencere: label })}** — ${t('owner.no_data')}`;

  const top = stats.top.map((entry) => `\`${entry.command}\` (${entry.count})`).join(', ');
  const rate = (stats.errorRate * 100).toFixed(1);
  return [
    `**${t('owner.usage.window', { pencere: label })}** — ${t('owner.usage.total', { adet: stats.total })}`,
    `> ${t('owner.usage.error_rate', { oran: rate })}`,
    `> ${t('owner.usage.top')}: ${top || '-'}`,
  ].join('\n');
}

export default {
  name: 'bot-kullanım',
  aliases: ['bot-kullanim'],
  description: 'Komut kullanım istatistiklerini gösterir.',
  category: 'Bot',

  async run(ctx) {
    const t = ctx.t;
    const report = await usageReport();

    if (!report.ok) {
      await ctx.reply(infoTemplate(t('owner.usage.title'), [t('owner.usage.no_data')]));
      return;
    }

    const sections = [];
    for (const label of ['24s', '7g', '30g']) {
      sections.push(renderWindow(t, label, report.windows[label]));
    }

    const guildRows = (report.windows['7g']?.topGuilds ?? []).map(
      (row) => `\`${row.guildId ?? '-'}\` — ${row.count}`,
    );
    sections.push({ separator: true });
    sections.push(`**${t('owner.usage.guilds')}**`);
    sections.push(guildRows.length > 0 ? guildRows.join('\n') : t('owner.no_data'));

    await ctx.reply(
      panel({
        emojiKey: 'GRAFIK',
        title: t('owner.usage.title'),
        sections,
        footer: footerLine([t('owner.usage.footer')]),
      }),
    );
  },
};
