/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { version as djsVersion } from 'discord.js';
import { kv } from '../../../ui/templates/index.js';
import { formatDuration } from '../../../core/argParser.js';

export default {
  name: 'bot-bilgi',
  aliases: ['bot-info', 'botbilgi'],
  description: 'Botun calisma bilgilerini (uptime, ping, RAM, surum) gosterir.',
  category: 'Bot',
  system: null,
  cooldown: 3,
  permission: { discord: [] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    const uptimeText = formatDuration(Math.floor(process.uptime() * 1000));
    const memoryMb = Math.round((process.memoryUsage().rss / 1_048_576) * 10) / 10;
    const commandCount = ctx.registry?.commands?.size ?? (ctx.registry?.commandList ?? []).length;

    const rows = [
      [t('moderation.bot.name'), `${ctx.client.user.tag} (\`${ctx.client.user.id}\`)`],
      [t('moderation.bot.uptime'), uptimeText],
      [t('moderation.bot.ping'), `${Math.round(ctx.client.ws.ping)} ms`],
      [t('moderation.bot.memory'), `${memoryMb} MB`],
      [t('moderation.bot.guilds'), `${ctx.client.guilds.cache.size} (bu sunucu: ${ctx.guild.memberCount})`],
      [t('moderation.bot.commands'), String(commandCount)],
      [t('moderation.bot.node'), process.version],
      [t('moderation.bot.djs'), djsVersion],
      [t('advanced.db'), t('advanced.db', { state: ctx.db?.ready ? t('common.enabled') : t('common.disabled') })],
    ];

    await ctx.reply(kv({ title: t('moderation.bot.title', { sunucu: ctx.guild.name }), emojiKey: 'BILGI', accent: 'primary', rows }));
  },
};
