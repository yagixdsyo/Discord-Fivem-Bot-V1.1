/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { canSeeCommand } from '../../../core/permissions.js';
import { getModule } from '../../../core/moduleRegistry.js';
import { getGuildConfig } from '../../../core/guildSettings.js';
import { collect } from '../../../ui/collect.js';
import {
  error as errorTemplate,
  list as listTemplate,
  usage as usageTemplate,
} from '../../../ui/templates/index.js';
import { disabledCard } from '../../../ui/templates/base.js';
import { parsePageCustomId } from '../../../ui/paginator.js';
import { row, selectMenu } from '../../../ui/v2.js';

const PAGE_SIZE = 8;
const SELECT_PREFIX = 'yardim:kat';
/** Discord select menusu en fazla 25 secenek kabul eder. */
const MAX_SELECT_OPTIONS = 25;

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
  if (command.category) return command.category;
  const def = getModule(command.module);
  return def?.name ?? command.module ?? 'Diğer';
}

/**
 * Kategori select satirlari: 25'ten fazla kategori tek select'e sigmaz,
 * bu yuzden 'Tumu' + ilk 24 kategori ilk select'e, kalani ek selectlere dagitilir.
 */
function categoryRows({ t, categories, category, ownerId }) {
  const allOption = {
    label: t('help.category_all'),
    value: 'tumu',
    default: category === 'tumu',
    emojiKey: 'KULLANICILAR',
  };
  const categoryOptions = categories.map((cat) => ({
    label: cat,
    value: cat,
    default: cat === category,
  }));

  const rows = [
    row([
      selectMenu({
        id: `${SELECT_PREFIX}:1:${ownerId}`,
        placeholder: t('help.category_placeholder'),
        options: [allOption, ...categoryOptions.slice(0, MAX_SELECT_OPTIONS - 1)],
      }),
    ]),
  ];

  let rest = categoryOptions.slice(MAX_SELECT_OPTIONS - 1);
  let index = 2;
  while (rest.length > 0) {
    rows.push(
      row([
        selectMenu({
          id: `${SELECT_PREFIX}:${index}:${ownerId}`,
          placeholder: t('help.category_placeholder'),
          options: rest.slice(0, MAX_SELECT_OPTIONS),
        }),
      ]),
    );
    rest = rest.slice(MAX_SELECT_OPTIONS);
    index += 1;
  }

  return rows;
}

/** Kategori + sayfa icin V2 payload uretir (test icin de acik). */
export function buildPage({ t, all, categories, category, page, ownerId, prefixOnly, prefixChar = '.' }) {
  const filtered = category === 'tumu' ? all : all.filter((c) => categoryOf(c) === category);

  return listTemplate({
    emojiKey: 'BELGE',
    title: t('help.title'),
    items: filtered,
    page,
    pageSize: PAGE_SIZE,
    namespace: `yardim-${slugify(category)}`,
    ownerId,
    renderItem: (cmd) =>
      prefixOnly?.has(cmd.name)
        ? `**\`${prefixChar}${cmd.name}\`** ${t('help.prefix_badge')} — ${cmd.description ?? ''}`
        : `**\`/${cmd.name}\`** — ${cmd.description ?? ''}`,
    emptyText: t('help.empty'),
    footer: `${t('help.summary', { adet: all.length, kategori: categories.length })} | ${t('common.total_items', { adet: filtered.length })}`,
    extraRows: categoryRows({ t, categories, category, ownerId }),
  });
}

export default {
  name: 'yardım',
  aliases: ['yardim', 'help', 'komutlar'],
  description: 'Komut listesini ve komut detaylarini gosterir.',
  cooldown: 3,
  guildOnly: false,
  args: [
    {
      name: 'komut',
      type: 'string',
      required: false,
      description: 'Detayini gormek istediginiz komutun adi',
    },
  ],
  examples: ['/yardım', '/yardım komut:ban', '.yardım', '.yardım ping'],

  async run(ctx) {
    const t = ctx.t;
    const registry = ctx.registry;
    if (!registry) {
      await ctx.reply(errorTemplate(t('errors.unexpected.title'), [t('errors.unexpected.body')]));
      return;
    }

    const isOwner = ctx.config.ownerIds.includes(ctx.user.id);
    const queryRaw = typeof ctx.args.komut === 'string' ? ctx.args.komut.trim() : '';

    const prefixOnly = registry.prefixOnly ?? new Set();
    let prefixChar = ctx.prefix ?? '.';
    if (ctx.source === 'slash' && ctx.guild) {
      const cfg = await getGuildConfig(ctx.guild.id).catch(() => null);
      prefixChar = cfg?.prefix ?? '.';
    }

    // ------------------------------------------------------------------
    // Detay modu: /yardım komut:<ad>
    // ------------------------------------------------------------------
    if (queryRaw) {
      const query = queryRaw.toLowerCase().replace(/^\//, '');
      const cmd = registry.commands.get(query) ?? registry.aliases?.get(query) ?? null;

      let visible = false;
      if (cmd && !cmd.ownerOnly) {
        visible = await canSeeCommand({ command: cmd, member: ctx.member, guild: ctx.guild, isOwner });
      }

      if (!visible) {
        await ctx.reply(errorTemplate(t('help.title'), [t('help.not_found', { komut: queryRaw })]));
        return;
      }

      const isPrefixOnly = prefixOnly.has(cmd.name);
      const card = usageTemplate(cmd, {
        prefix: isPrefixOnly ? prefixChar : ctx.source === 'slash' ? '/' : ctx.prefix,
        labels: { title: t('help.title') },
        note: isPrefixOnly ? t('help.prefix_only', { prefix: prefixChar, komut: cmd.name }) : undefined,
      });
      await ctx.reply(card);
      return;
    }

    // ------------------------------------------------------------------
    // Listeleme modu
    // ------------------------------------------------------------------
    const all = [];
    for (const cmd of registry.commandList) {
      if (cmd.ownerOnly) continue;
      if (await canSeeCommand({ command: cmd, member: ctx.member, guild: ctx.guild, isOwner })) {
        all.push(cmd);
      }
    }
    all.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    const categories = [...new Set(all.map(categoryOf))].sort((a, b) => a.localeCompare(b, 'tr'));

    const ownerId = ctx.user.id;
    let latest = buildPage({ t, all, categories, category: 'tumu', page: 0, ownerId, prefixOnly, prefixChar }).payload;

    const message = await ctx.reply(latest, { fetchReply: true });
    if (!message?.createMessageComponentCollector) return; // etkilesim kurulamazsa sessizce gec

    collect(message, {
      filter: (i) => i.user.id === ownerId,
      onCollect: async (i) => {
        // Kategori secimi (birden fazla select olabilir: yardim:kat:<sira>:<owner>)
        const selectParts = i.isStringSelectMenu?.() ? String(i.customId).split(':') : null;
        if (selectParts && selectParts[0] === 'yardim' && selectParts[1] === 'kat' && selectParts[3] === ownerId) {
          latest = buildPage({ t, all, categories, category: i.values[0], page: 0, ownerId, prefixOnly, prefixChar }).payload;
          await i.update(latest);
          return;
        }

        // Sayfa butonlari
        const parsed = parsePageCustomId(i.customId);
        if (parsed && parsed.ownerId === ownerId) {
          const slug = parsed.namespace.replace(/^yardim-/, '');
          const category = categories.find((c) => slugify(c) === slug) ?? 'tumu';
          latest = buildPage({ t, all, categories, category, page: parsed.page, ownerId, prefixOnly, prefixChar }).payload;
          await i.update(latest);
          return;
        }

        await i.deferUpdate().catch(() => {});
      },
      onEnd: async () => {
        try {
          await message.edit(disabledCard(latest));
        } catch {
          /* mesaj silinmis veya duzenlenemiyor */
        }
      },
    });
  },
};
