/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { emojiReport, verifyEmojis } from '../../ui/emoji.js';
import { panel } from '../../ui/templates/index.js';

export default {
  name: 'emoji-kontrol',
  description: 'Emoji anahtarlarının durumunu raporlar.',
  category: 'Sistem',
  args: [{ name: 'girdi', type: 'rest', required: false, description: '--dogrula: yeniden doğrula' }],

  async run(ctx) {
    const t = ctx.t;
    const raw = String(ctx.args.girdi ?? '');

    if (raw.includes('--dogrula')) {
      await verifyEmojis(ctx.client).catch(() => {});
    }

    const report = emojiReport();
    const verify = report.verify ?? null;

    const missingEnv = report.missingKeys.length > 0 ? report.missingKeys.join(', ') : t('owner.no_data');
    const missingDiscord = verify
      ? verify.missingInDiscord?.length > 0
        ? verify.missingInDiscord.map((m) => m.key).join(', ')
        : t('owner.no_data')
      : t('owner.emoji.not_verified');

    const sections = [
      `**${t('owner.emoji.source')}:** ${report.source}${report.guildId ? ` (${report.guildId})` : ''}`,
      `**${t('owner.emoji.total')}:** ${report.total}`,
      `**${t('owner.emoji.filled')}:** ${report.filled}`,
      `**${t('owner.emoji.missing_env')}:** ${report.missingKeys.length}`,
      { separator: true },
      `**${t('owner.emoji.missing_env_list')}:**`,
      missingEnv,
      { separator: true },
      `**${t('owner.emoji.missing_discord_list')}:**`,
      missingDiscord,
    ];

    if (verify?.note) sections.push(`-# ${verify.note}`);
    if (verify?.checkedAt) sections.push(`-# ${t('owner.emoji.checked_at')}: ${verify.checkedAt}`);

    await ctx.reply(panel({ emojiKey: 'ID', title: t('owner.emoji.title'), sections }));
  },
};
