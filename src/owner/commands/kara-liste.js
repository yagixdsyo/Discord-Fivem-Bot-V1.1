/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { listBlacklistEntries } from '../lib/state.js';
import { collect } from '../../ui/collect.js';
import { list as listTemplate } from '../../ui/templates/index.js';
import { disabledCard } from '../../ui/templates/base.js';
import { parsePageCustomId } from '../../ui/paginator.js';

const PAGE_SIZE = 8;
const NS = 'owner-kara';

function buildPage({ t, entries, page, ownerId }) {
  return listTemplate({
    emojiKey: 'BLACKLIST',
    title: t('owner.blacklist.list_title'),
    items: entries,
    page,
    pageSize: PAGE_SIZE,
    namespace: NS,
    ownerId,
    renderItem: (entry) => {
      const ts = Math.floor(new Date(entry.added_at ?? Date.now()).getTime() / 1000);
      const reason = entry.reason ?? t('owner.value_none');
      return `**\`${entry.guild_id}\`** — ${reason} — <t:${ts}:R>`;
    },
    emptyText: t('owner.blacklist.empty'),
    footer: t('owner.blacklist.count', { adet: entries.length }),
  });
}

export default {
  name: 'kara-liste',
  description: 'Kara listedeki sunucuları listeler.',
  category: 'Sunucu',

  async run(ctx) {
    const t = ctx.t;
    const ownerId = ctx.user.id;
    const entries = await listBlacklistEntries();

    let latest = buildPage({ t, entries, page: 0, ownerId }).payload;
    const message = await ctx.reply(latest, { fetchReply: true });
    if (!message?.createMessageComponentCollector) return;

    collect(message, {
      filter: (i) => {
        if (i.user.id !== ownerId) return false;
        const parsed = parsePageCustomId(i.customId);
        return Boolean(parsed && parsed.namespace === NS && parsed.ownerId === ownerId);
      },
      onCollect: async (i) => {
        const parsed = parsePageCustomId(i.customId);
        if (parsed && parsed.ownerId === ownerId) {
          latest = buildPage({ t, entries, page: parsed.page, ownerId }).payload;
          await i.update(latest);
        }
      },
      onEnd: async () => {
        try {
          await message.edit(disabledCard(latest));
        } catch {
          /* duzenlenemedi */
        }
      },
    });
  },
};
