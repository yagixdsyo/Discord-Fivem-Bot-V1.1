/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { info, success } from '../../ui/templates/index.js';
import { row, selectMenu } from '../../ui/v2.js';
import { collect } from '../../ui/collect.js';
import { withDisabledButtons } from '../../ui/v2.js';
import { classifyScopeToken } from './parse.js';

function trLower(value) {
  return String(value ?? '').toLocaleLowerCase('tr');
}

/**
 * Kapsam token'i: 'global' | sunucu ID | sunucu adi | bos (global).
 * @returns {Promise<{ok: boolean, scope?: string, label?: string, guildId?: string|null}>}
 */
export async function resolveScopeChoice(ctx, token) {
  const cls = classifyScopeToken(token);

  if (cls.type === 'default' || cls.type === 'global') {
    return { ok: true, scope: 'global', label: ctx.t('owner.scope_global'), guildId: null };
  }

  if (cls.type === 'id') {
    const guild =
      ctx.client.guilds.cache.get(cls.value) ??
      (await ctx.client.guilds.fetch(cls.value).catch(() => null));
    if (!guild) {
      await ctx.reply(info(ctx.t('owner.guild_not_found', { girdi: cls.value }), []));
      return { ok: false };
    }
    return { ok: true, scope: guild.id, label: guild.name, guildId: guild.id };
  }

  const guild = await resolveTargetGuild(ctx, cls.value);
  if (!guild) return { ok: false };
  return { ok: true, scope: guild.id, label: guild.name, guildId: guild.id };
}

/** Ad/ad parcasi ile eslesen sunucular (en fazla 25). */
export function searchGuildsByName(client, query) {
  const wanted = trLower(query);
  if (!wanted) return [];
  return [...client.guilds.cache.values()]
    .filter((g) => trLower(g.name).includes(wanted))
    .slice(0, 25);
}

/**
 * Girdiyi sunucuya cevirir. Etkilesimli: belirsizse select menu gosterir.
 * @param {object} ctx komut baglami
 * @param {string|null} input kullanici girdisi (bos -> icinde bulunulan sunucu)
 * @param {{required?: boolean}} [opts]
 * @returns {Promise<import('discord.js').Guild|null>}
 */
export async function resolveTargetGuild(ctx, input, { required = true } = {}) {
  const client = ctx.client;
  const raw = String(input ?? '').trim();

  if (!raw) {
    if (ctx.guild) return ctx.guild;
    if (!required) return null;
    await ctx.reply(info(ctx.t('owner.guild_required'), [ctx.t('owner.guild_input_hint')]));
    return null;
  }

  if (/^\d{15,25}$/.test(raw)) {
    const guild = client.guilds.cache.get(raw) ?? (await client.guilds.fetch(raw).catch(() => null));
    if (guild) return guild;
    await ctx.reply(info(ctx.t('owner.guild_not_found', { girdi: raw }), []));
    return null;
  }

  const matches = searchGuildsByName(client, raw);
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    await ctx.reply(info(ctx.t('owner.guild_not_found', { girdi: raw }), []));
    return null;
  }

  return await pickGuildFromMenu(ctx, matches);
}

/**
 * Birden fazla eslesmede select menu gosterip secimi bekler.
 * @returns {Promise<import('discord.js').Guild|null>}
 */
export async function pickGuildFromMenu(ctx, matches) {
  const ownerId = ctx.user.id;
  const options = matches.slice(0, 25).map((g) => ({
    label: String(g.name).slice(0, 100),
    value: g.id,
    description: ctx.t('owner.guild_option_desc', { uye: g.memberCount ?? '?' }),
  }));

  const menuRow = row([
    selectMenu({
      id: `owner:secim:${ownerId}`,
      placeholder: ctx.t('owner.guild_select_placeholder'),
      options,
    }),
  ]);

  const baseCard = info(ctx.t('owner.guild_ambiguous'), [ctx.t('owner.guild_select_hint')], {
    buttons: [menuRow],
  });

  const message = await ctx.reply(baseCard, { fetchReply: true });
  if (!message?.createMessageComponentCollector) return null;

  return await new Promise((resolve) => {
    let settled = false;

    collect(message, {
      filter: (i) => i.user.id === ownerId,
      timeMs: 60_000,
      onCollect: async (i) => {
        if (settled) return;
        settled = true;
        const guild = ctx.client.guilds.cache.get(i.values?.[0]) ?? null;
        try {
          await i.update(
            guild
              ? success(ctx.t('owner.guild_selected', { sunucu: guild.name }), [])
              : withDisabledButtons(baseCard),
          );
        } catch {
          /* guncellenemedi */
        }
        resolve(guild);
      },
      onEnd: async () => {
        if (settled) return;
        settled = true;
        try {
          await message.edit(withDisabledButtons(baseCard));
        } catch {
          /* duzenlenemedi */
        }
        resolve(null);
      },
    });
  });
}
