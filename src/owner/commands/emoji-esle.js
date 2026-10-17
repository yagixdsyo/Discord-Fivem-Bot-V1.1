/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { emojiReport } from '../../ui/emoji.js';
import { emojiEnvKey, emojiAnimEnvKey } from '../../ui/emojiKeys.js';
import { matchEmojis } from '../../ui/emojiMatch.js';
import { panel } from '../../ui/templates/index.js';

const MAX_LINES = 100;

async function fetchAvailable(client, report) {
  try {
    if (report.source === 'application') {
      const emojis = await client.application?.emojis?.fetch();
      return emojis ? [...emojis.values()].map((e) => ({ id: e.id, name: e.name, animated: e.animated })) : [];
    }
    if (!report.guildId) return [];
    const guild =
      client.guilds.cache.get(report.guildId) ??
      (await client.guilds.fetch(report.guildId).catch(() => null));
    if (!guild) return [];
    const emojis = await guild.emojis.fetch();
    return emojis ? [...emojis.values()].map((e) => ({ id: e.id, name: e.name, animated: e.animated })) : [];
  } catch {
    return null;
  }
}

export default {
  name: 'emoji-esle',
  aliases: ['emoji-doldur'],
  description: 'Eksik emoji anahtarlarını kaynaktaki isimlerle eşler (.env bloğu).',
  category: 'Sistem',

  async run(ctx) {
    const t = ctx.t;
    const report = emojiReport();

    const missing = report.missingKeys ?? [];
    const sections = [
      `**${t('owner.emoji.source')}:** ${report.source}${report.guildId ? ` (${report.guildId})` : ''}`,
    ];

    if (!missing.length) {
      sections.push(t('owner.emoji.match_no_missing'));
      await ctx.reply(panel({ emojiKey: 'ID', title: t('owner.emoji.match_title'), sections }));
      return;
    }

    const available = await fetchAvailable(ctx.client, report);
    if (available === null) {
      sections.push(t('owner.emoji.match_fetch_failed'));
      await ctx.reply(panel({ emojiKey: 'ID', title: t('owner.emoji.match_title'), sections }));
      return;
    }

    const { matched, unmatched } = matchEmojis({ keys: missing, available });

    sections.push(
      t('owner.emoji.match_summary', {
        eslesen: matched.length,
        eslesmeyen: unmatched.length,
        toplam: missing.length,
      }),
    );

    if (matched.length) {
      const envLines = [
        ...matched.map((m) => `${emojiEnvKey(m.key)}=${m.id}`),
        ...matched.filter((m) => m.animated).map((m) => `${emojiAnimEnvKey(m.key)}=true`),
      ];
      const shown = envLines.slice(0, MAX_LINES);
      sections.push({ separator: true });
      sections.push(`**${t('owner.emoji.match_env_hint')}**`);
      sections.push(`\`\`\`\n${shown.join('\n')}\n\`\`\``);
      if (envLines.length > MAX_LINES) {
        sections.push(`-# ${t('owner.emoji.match_overflow', { adet: shown.length })}`);
      }
    } else {
      sections.push(`-# ${t('owner.emoji.match_none')}`);
    }

    if (unmatched.length) {
      sections.push({ separator: true });
      sections.push(
        t('owner.emoji.match_unmatched', { liste: unmatched.map((k) => `\`${k.toLowerCase()}\``).join(', ') }),
      );
    }

    await ctx.reply(panel({ emojiKey: 'ID', title: t('owner.emoji.match_title'), sections }));
  },
};
