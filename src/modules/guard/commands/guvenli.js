/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success as successTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { addSafeEntry, getSafeList, removeSafeEntry } from '../lib/config.js';
import { incidentsPayload, guvenliListPayload } from '../lib/view.js';
import { listRecentIncidents } from '../lib/incidents.js';

const OPERATIONS = ['ekle', 'cikar', 'liste', 'bilgi'];

export default {
  name: 'guvenli',
  aliases: [],
  description: 'Güvenli liste: guard cezalarından muaf kişiler (kademeli).',
  category: 'Guard',
  system: 'guard',
  cooldown: 5,
  permission: { discord: ['Administrator'] },
  args: [
    {
      name: 'islem',
      type: 'choice',
      required: true,
      description: 'İşlem',
      choices: OPERATIONS.map((value) => ({ name: value, value })),
    },
    { name: 'kisi', type: 'user', required: false, description: 'Kullanıcı (ekle/cikar için)' },
    { name: 'kademe', type: 'integer', required: false, description: 'Kademe 1-4 (varsayılan 4)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const islem = String(ctx.args.islem ?? 'liste').toLowerCase();
    const ownerOnly = islem === 'ekle' || islem === 'cikar';

    if (ownerOnly) {
      const isServerOwner = ctx.guild.ownerId === ctx.user.id;
      const isBotOwner = (ctx.config?.ownerIds ?? []).includes(ctx.user.id);
      if (!isServerOwner && !isBotOwner) {
        await ctx.reply(
          errorTemplate(t('guard.safe.owner_only_title'), [t('guard.safe.owner_only_body')]),
        );
        return;
      }
    }

    if (islem === 'liste') {
      const entries = await getSafeList(ctx.guild.id);
      await ctx.reply(guvenliListPayload(t, { entries }));
      return;
    }

    if (islem === 'bilgi') {
      const entries = await getSafeList(ctx.guild.id);
      const safeIds = new Set(entries.map((doc) => doc.user_id));
      const incidents = (await listRecentIncidents(ctx.guild.id, 100)).filter(
        (doc) => doc.safe && doc.actor_id && safeIds.has(doc.actor_id),
      );
      await ctx.reply(
        incidentsPayload(t, {
          incidents: incidents.slice(0, 10),
          title: t('guard.safe.info_title', { kisi: entries.length }),
        }),
      );
      return;
    }

    const target = ctx.args.kisi;
    if (!target?.id) {
      await ctx.reply(errorTemplate(t('guard.safe.missing_user_title'), [t('guard.safe.missing_user_body')]));
      return;
    }
    if (target.id === ctx.guild.ownerId || target.id === ctx.client?.user?.id) {
      await ctx.reply(errorTemplate(t('guard.safe.always_exempt_title'), [t('guard.safe.always_exempt_body')]));
      return;
    }

    if (islem === 'ekle') {
      const tier = Math.min(Math.max(Number(ctx.args.kademe) || 4, 1), 4);
      const result = await addSafeEntry({
        guildId: ctx.guild.id,
        userId: target.id,
        tier,
        addedBy: ctx.user.id,
        label: target.username ?? null,
      });
      if (!result.ok) {
        await ctx.reply(errorTemplate(t('guard.ayar.failed_title'), [t('guard.ayar.failed_body')]));
        return;
      }
      await ctx.reply(
        successTemplate(t('guard.safe.added_title', { kisi: target.tag ?? target.username ?? target.id }), [
          t('guard.safe.added_body', { kademe: result.tier }),
        ]),
      );
      await emitLog(ctx.guild, 'log_guvenli_liste', {
        actor: ctx.user.id,
        actorTag: ctx.user.username ?? null,
        target: target.id,
        targetTag: target.tag ?? target.username ?? null,
        lines: ['İşlem: **Güvenli listeye eklendi**', `Kademe: **${result.tier}**`],
      });
      return;
    }

    if (islem === 'cikar') {
      const result = await removeSafeEntry(ctx.guild.id, target.id);
      if (!result.ok || !result.removed) {
        await ctx.reply(errorTemplate(t('guard.safe.not_found_title'), [t('guard.safe.not_found_body')]));
        return;
      }
      await ctx.reply(
        successTemplate(t('guard.safe.removed_title', { kisi: target.tag ?? target.username ?? target.id }), [
          t('guard.safe.removed_body'),
        ]),
      );
      await emitLog(ctx.guild, 'log_guvenli_liste', {
        actor: ctx.user.id,
        actorTag: ctx.user.username ?? null,
        target: target.id,
        targetTag: target.tag ?? target.username ?? null,
        lines: ['İşlem: **Güvenli listeden çıkarıldı**'],
      });
    }
  },
};
