/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { collect } from '../../ui/collect.js';
import { list as listTemplate } from '../../ui/templates/index.js';
import { disabledCard } from '../../ui/templates/base.js';
import { parsePageCustomId } from '../../ui/paginator.js';
import { row, selectMenu } from '../../ui/v2.js';

const PAGE_SIZE = 8;
const SELECT_PREFIX = 'owner-yardim';

const TR_MAP = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

function slugify(text) {
  const slug = String(text ?? '')
    .toLowerCase()
    .split('')
    .map((ch) => TR_MAP[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, 24) || 'diger';
}

function categoryOf(command) {
  return command.category ?? 'Genel';
}

function buildPage({ t, all, categories, category, page, ownerId }) {
  const filtered = category === 'tumu' ? all : all.filter((c) => categoryOf(c) === category);

  const options = [
    {
      label: t('help.category_all'),
      value: 'tumu',
      default: category === 'tumu',
      emojiKey: 'KULLANICILAR',
    },
    ...categories.map((cat) => ({
      label: cat,
      value: cat,
      default: cat === category,
    })),
  ];

  return listTemplate({
    emojiKey: 'BELGE',
    title: t('owner.help_title'),
    items: filtered,
    page,
    pageSize: PAGE_SIZE,
    namespace: `owner-yardim-${slugify(category)}`,
    ownerId,
    renderItem: (cmd) => `**\`!${cmd.name}\`** — ${cmd.description ?? ''}`,
    emptyText: t('owner.no_data'),
    footer: t('owner.help_footer', { adet: all.length }),
    extraRows: [
      row([
        selectMenu({
          id: `${SELECT_PREFIX}:${ownerId}`,
          placeholder: t('owner.help_placeholder'),
          options,
        }),
      ]),
    ],
  });
}

export default {
  name: 'yardım',
  aliases: ['yardim'],
  description: 'Sahip komutlarını kategorili listeler.',
  category: 'Genel',

  async run(ctx) {
    const t = ctx.t;
    const all = [...(ctx.registry?.ownerList ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    const categories = [...new Set(all.map(categoryOf))].sort((a, b) => a.localeCompare(b, 'tr'));

    const ownerId = ctx.user.id;
    let latest = buildPage({ t, all, categories, category: 'tumu', page: 0, ownerId }).payload;

    const message = await ctx.reply(latest, { fetchReply: true });
    if (!message?.createMessageComponentCollector) return;

    collect(message, {
      filter: (i) => i.user.id === ownerId,
      onCollect: async (i) => {
        if (i.isStringSelectMenu?.() && i.customId === `${SELECT_PREFIX}:${ownerId}`) {
          latest = buildPage({ t, all, categories, category: i.values[0], page: 0, ownerId }).payload;
          await i.update(latest);
          return;
        }

        const parsed = parsePageCustomId(i.customId);
        if (parsed && parsed.ownerId === ownerId) {
          const slug = String(parsed.namespace).replace(/^owner-yardim-/, '');
          const category = categories.find((c) => slugify(c) === slug) ?? 'tumu';
          latest = buildPage({ t, all, categories, category, page: parsed.page, ownerId }).payload;
          await i.update(latest);
          return;
        }

        await i.deferUpdate().catch(() => {});
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
