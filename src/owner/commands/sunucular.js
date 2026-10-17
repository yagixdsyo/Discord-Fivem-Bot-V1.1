/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { panel } from '../../ui/templates/index.js';
import { disabledCard } from '../../ui/templates/base.js';
import { collect } from '../../ui/collect.js';
import { pageButtons, parsePageCustomId, slicePage } from '../../ui/paginator.js';
import { button, footerLine, row, selectMenu } from '../../ui/v2.js';

const PAGE_SIZE = 4;
const NS = 'owner-sunucular';
const SORT_PREFIX = 'owner-sunucular-sirala';

function sortGuilds(guilds, sortKey) {
  const list = [...guilds];
  if (sortKey === 'isim') list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'tr'));
  else if (sortKey === 'katilma') list.sort((a, b) => (a.joinedTimestamp ?? 0) - (b.joinedTimestamp ?? 0));
  else list.sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0));
  return list;
}

function buildPage({ t, guilds, sortKey, page, ownerId }) {
  const sliced = slicePage(guilds, page, PAGE_SIZE);

  const lines = sliced.pageItems.map((g, idx) => {
    const n = sliced.page * PAGE_SIZE + idx + 1;
    return t('owner.servers.entry', { sira: n, isim: g.name, uye: g.memberCount ?? '?', id: g.id });
  });

  const actionRows = sliced.pageItems.map((g) =>
    row([
      button({ id: `owner:srv:detay:${g.id}:${ownerId}`, label: t('owner.btn_detail'), emojiKey: 'ARAMA' }),
      button({
        id: `owner:srv:kara:${g.id}:${ownerId}`,
        label: t('owner.btn_blacklist'),
        emojiKey: 'BLACKLIST',
        style: 'danger',
      }),
      button({ id: `owner:srv:ayril:${g.id}:${ownerId}`, label: t('owner.btn_leave'), emojiKey: 'CIKAR' }),
    ]),
  );

  const sortRow = row([
    selectMenu({
      id: `${SORT_PREFIX}:${ownerId}`,
      placeholder: t('owner.servers.sort_placeholder'),
      options: [
        { label: t('owner.servers.sort_members'), value: 'uye', default: sortKey === 'uye' },
        { label: t('owner.servers.sort_name'), value: 'isim', default: sortKey === 'isim' },
        { label: t('owner.servers.sort_joined'), value: 'katilma', default: sortKey === 'katilma' },
      ],
    }),
  ]);

  return panel({
    emojiKey: 'KULLANICILAR',
    title: t('owner.servers.title'),
    subtitle: t('owner.servers.count', { adet: guilds.length }),
    sections: lines.length > 0 ? lines : [t('owner.servers.empty')],
    buttons: [
      ...actionRows,
      pageButtons({ namespace: NS, page: sliced.page, totalPages: sliced.totalPages, ownerId }),
      sortRow,
    ],
    footer: footerLine([t('owner.servers.footer_hint')]),
  });
}

export default {
  name: 'sunucular',
  description: 'Botun bulunduğu sunucuları listeler.',
  category: 'Sunucu',
  args: [
    {
      name: 'arama',
      type: 'rest',
      required: false,
      description: 'Sunucu adında arama (isteğe bağlı)',
    },
  ],

  async run(ctx) {
    const t = ctx.t;
    const ownerId = ctx.user.id;
    const query = String(ctx.args.arama ?? '').trim().toLocaleLowerCase('tr');

    let guilds = [...ctx.client.guilds.cache.values()];
    if (query) {
      guilds = guilds.filter((g) => String(g.name).toLocaleLowerCase('tr').includes(query));
    }
    let sortKey = 'uye';
    guilds = sortGuilds(guilds, sortKey);

    let latest = buildPage({ t, guilds, sortKey, page: 0, ownerId }).payload;
    const message = await ctx.reply(latest, { fetchReply: true });
    if (!message?.createMessageComponentCollector) return;

    collect(message, {
      // Yalnizca bu panelin secim/sayfa bilesenleri; srv butonlari router'a gider.
      filter: (i) => {
        if (i.user.id !== ownerId) return false;
        if (i.isStringSelectMenu?.() && i.customId === `${SORT_PREFIX}:${ownerId}`) return true;
        const parsed = parsePageCustomId(i.customId);
        return Boolean(parsed && parsed.namespace === NS && parsed.ownerId === ownerId);
      },
      onCollect: async (i) => {
        if (i.isStringSelectMenu?.() && i.customId === `${SORT_PREFIX}:${ownerId}`) {
          sortKey = i.values[0];
          guilds = sortGuilds(guilds, sortKey);
          latest = buildPage({ t, guilds, sortKey, page: 0, ownerId }).payload;
          await i.update(latest);
          return;
        }

        const parsed = parsePageCustomId(i.customId);
        if (parsed && parsed.ownerId === ownerId) {
          latest = buildPage({ t, guilds, sortKey, page: parsed.page, ownerId }).payload;
          await i.update(latest);
        }
      },
      onEnd: async () => {
        try {
          await message.edit(disabledCard(latest));
        } catch {
          /* mesaj duzenlenemedi */
        }
      },
    });
  },
};
