/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { parseUserId } from '../lib/util.js';
import { tepkiSayPayload } from '../lib/view.js';

const MAX_REACTIONS = 10;
const MAX_USERS = 10;

export default {
  name: 'tepki-say',
  aliases: ['tepkisay'],
  description: 'Bir mesajdaki tepkileri sayar.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  permission: { discord: ['ManageMessages'] },
  args: [
    { name: 'mesaj-id', type: 'string', required: true, description: 'Mesaj ID (veya mesaj linki)' },
    { name: 'kanal', type: 'channel', required: false, description: 'Kanal (boşsa bu kanal)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const channel = ctx.args.kanal ?? ctx.channel;
    const raw = String(ctx.args['mesaj-id'] ?? '').trim();
    const linkMatch = raw.match(/channels\/\d+\/(\d+)\/(\d+)/);
    const messageId = linkMatch ? linkMatch[2] : parseUserId(raw);

    if (!messageId || !channel?.messages) {
      await ctx.reply(errorTemplate(t('moderation.reactions.bad_id_title'), [t('moderation.reactions.bad_id_body')]));
      return;
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      await ctx.reply(errorTemplate(t('moderation.reactions.not_found_title'), [t('moderation.reactions.not_found_body')]));
      return;
    }

    const entries = [];
    const reactions = [...message.reactions.cache.values()].slice(0, MAX_REACTIONS);
    for (const reaction of reactions) {
      let users = [];
      try {
        const fetched = await reaction.users.fetch({ limit: MAX_USERS });
        users = [...fetched.values()].filter((user) => !user.bot).map((user) => user.id);
      } catch {
        users = [];
      }
      entries.push({
        emoji: reaction.emoji?.toString() ?? '?',
        count: Math.max(0, (reaction.count ?? 0) - (reaction.me ? 1 : 0)),
        users,
      });
    }

    await ctx.reply(
      tepkiSayPayload(t, {
        channelRef: `**#${channel.name ?? channel.id}** • \`${messageId}\``,
        entries,
      }),
    );
  },
};
