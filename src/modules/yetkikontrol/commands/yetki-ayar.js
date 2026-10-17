/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';
import { listCommandNodes } from '../../../core/loader.js';

function parseTargets(raw, guild) {
  const roleIds = new Set();
  const userIds = new Set();
  const invalid = [];
  for (const token of String(raw || '').split(/\s+/).filter(Boolean)) {
    const roleMatch = token.match(/^<@&(\d+)>$/);
    if (roleMatch) {
      roleIds.add(roleMatch[1]);
      continue;
    }
    const userMatch = token.match(/^<@!?(\d+)>$/);
    if (userMatch) {
      userIds.add(userMatch[1]);
      continue;
    }
    if (/^\d{5,}$/.test(token)) {
      if (guild?.roles?.cache?.has?.(token)) roleIds.add(token);
      else userIds.add(token);
      continue;
    }
    invalid.push(token);
  }
  return { roleIds: [...roleIds], userIds: [...userIds], invalid };
}

function mentionList(ids, kind) {
  if (!ids?.length) return null;
  return ids.map((id) => (kind === 'role' ? `<@&${id}>` : `<@${id}>`)).join(', ');
}

/** Rol etiketi veya ID'sinden rol kimliği çözer; bulunamazsa null. */
function parseRoleId(raw, guild) {
  const s = String(raw ?? '').trim();
  const mention = s.match(/^<@&(\d+)>$/)?.[1];
  if (mention) return mention;
  if (/^\d{5,}$/.test(s) && (!guild || guild.roles?.cache?.has?.(s))) return s;
  return null;
}

export default {
  name: 'yetki-ayar',
  aliases: ['yetkiayar'],
  description: 'Yetki düğümü eşlemelerini ve rütbe seviyelerini yönetir.',
  category: 'Yetki',
  system: 'yetkikontrol',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'islem', type: 'string', required: true, description: 'liste|dugumler|ver|al|temizle|kontrol|rutbe' },
    { name: 'parametre', type: 'rest', required: false, description: 'Düğüm adı, hedefler veya rütbe alt işlemi' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const lib = await import('../lib/permNodes.js');
    const op = String(ctx.args.islem || '').toLowerCase();
    const raw = String(ctx.args.parametre || '').trim();
    const pieces = raw.split(/\s+/).filter(Boolean);

    const usageLines = () => [
      t('yetki.ayar_usage_ver'),
      t('yetki.ayar_usage_al'),
      t('yetki.ayar_usage_temizle'),
      t('yetki.ayar_usage_liste'),
      t('yetki.ayar_usage_dugumler'),
      t('yetki.ayar_usage_kontrol'),
      t('yetki.ayar_usage_rutbe'),
    ];

    if (op === 'liste' || op === 'list') {
      const nodes = await lib.listPermNodes(ctx.guild.id);
      if (!nodes.length) {
        await ctx.reply(listTemplate({ title: t('yetki.ayar_list_title'), lines: [t('yetki.ayar_list_empty')] }));
        return;
      }
      const commandNodes = new Map(listCommandNodes().map((x) => [x.node, x.commands]));
      const lines = nodes.map((doc) =>
        t('yetki.ayar_list_line', {
          node: `\`${doc.node}\``,
          roller: mentionList(doc.role_ids ?? [], 'role') ?? t('common.none'),
          kisiler: mentionList(doc.user_ids ?? [], 'user') ?? t('common.none'),
          komutlar: commandNodes.get(doc.node)?.join(', ') ?? '-',
        }),
      );
      await ctx.reply(listTemplate({ title: t('yetki.ayar_list_title'), lines }));
      return;
    }

    if (op === 'dugumler' || op === 'nodes') {
      const commandNodes = listCommandNodes();
      const defined = await lib.listPermNodes(ctx.guild.id);
      const definedSet = new Set(defined.map((x) => x.node));
      const lines = commandNodes.map((x) =>
        t('yetki.ayar_node_line', {
          node: `\`${x.node}\``,
          komutlar: x.commands.map((c) => `/${c}`).join(', '),
          durum: definedSet.has(x.node) ? t('yetki.ayar_defined') : t('yetki.ayar_undefined'),
        }),
      );
      for (const doc of defined) {
        if (!commandNodes.some((x) => x.node === doc.node)) {
          lines.push(t('yetki.ayar_node_line', { node: `\`${doc.node}\``, komutlar: '/-', durum: t('yetki.ayar_defined') }));
        }
      }
      if (!lines.length) lines.push(t('yetki.ayar_nodes_empty'));
      await ctx.reply(listTemplate({ title: t('yetki.ayar_nodes_title'), lines }));
      return;
    }

    if (op === 'kontrol' || op === 'goster') {
      const node = pieces[0];
      if (!node) {
        await ctx.reply(errorTemplate(t('yetki.ayar_node_bad_title'), [t('yetki.ayar_node_bad'), ...usageLines()]));
        return;
      }
      const doc = await lib.getNode(ctx.guild.id, node);
      if (!doc) {
        await ctx.reply(errorTemplate(t('yetki.ayar_missing_title'), [t('yetki.ayar_missing', { node: `\`${node}\`` })]));
        return;
      }
      const lines = [
        t('yetki.ayar_detail_roles', { liste: mentionList(doc.role_ids ?? [], 'role') ?? t('common.none') }),
        t('yetki.ayar_detail_users', { liste: mentionList(doc.user_ids ?? [], 'user') ?? t('common.none') }),
      ];
      if (doc.updated_at) {
        lines.push(t('yetki.ayar_detail_updated', { tarih: `<t:${Math.floor(new Date(doc.updated_at).getTime() / 1000)}:R>` }));
      }
      await ctx.reply(listTemplate({ title: t('yetki.ayar_detail_title', { node: doc.node }), lines }));
      return;
    }

    if (op === 'ver' || op === 'ekle' || op === 'bind') {
      const node = pieces[0];
      if (!node) {
        await ctx.reply(errorTemplate(t('yetki.ayar_node_bad_title'), [t('yetki.ayar_node_bad'), ...usageLines()]));
        return;
      }
      const { roleIds, userIds, invalid } = parseTargets(pieces.slice(1).join(' '), ctx.guild);
      if (!roleIds.length && !userIds.length) {
        await ctx.reply(errorTemplate(t('yetki.ayar_target_need_title'), [t('yetki.ayar_target_need'), ...usageLines()]));
        return;
      }
      const res = await lib.bindPermNode({ guildId: ctx.guild.id, node, roleIds, userIds });
      if (!res.ok) {
        await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
        return;
      }
      const lines = [
        t('yetki.ayar_bound', {
          node: `\`${res.doc.node}\``,
          roller: mentionList(res.doc.role_ids, 'role') ?? t('common.none'),
          kisiler: mentionList(res.doc.user_ids, 'user') ?? t('common.none'),
        }),
      ];
      if (invalid.length) lines.push(t('yetki.ayar_invalid_skipped', { liste: invalid.join(', ').slice(0, 200) }));
      await ctx.reply(success(t('yetki.ayar_bound_title'), lines));
      return;
    }

    if (op === 'al' || op === 'kaldir' || op === 'unbind') {
      const node = pieces[0];
      if (!node) {
        await ctx.reply(errorTemplate(t('yetki.ayar_node_bad_title'), [t('yetki.ayar_node_bad'), ...usageLines()]));
        return;
      }
      const { roleIds, userIds } = parseTargets(pieces.slice(1).join(' '), ctx.guild);
      if (!roleIds.length && !userIds.length) {
        await ctx.reply(errorTemplate(t('yetki.ayar_target_need_title'), [t('yetki.ayar_target_need'), ...usageLines()]));
        return;
      }
      const res = await lib.unbindPermNode({ guildId: ctx.guild.id, node, roleIds, userIds });
      if (!res.ok) {
        await ctx.reply(errorTemplate(t('yetki.ayar_missing_title'), [t('yetki.ayar_missing', { node: `\`${node}\`` })]));
        return;
      }
      await ctx.reply(
        success(t('yetki.ayar_unbound_title'), [
          t('yetki.ayar_unbound', {
            node: `\`${res.doc.node}\``,
            roller: mentionList(res.doc.role_ids, 'role') ?? t('common.none'),
            kisiler: mentionList(res.doc.user_ids, 'user') ?? t('common.none'),
          }),
        ]),
      );
      return;
    }

    if (op === 'temizle' || op === 'sil' || op === 'clear') {
      const node = pieces[0];
      if (!node) {
        await ctx.reply(errorTemplate(t('yetki.ayar_node_bad_title'), [t('yetki.ayar_node_bad'), ...usageLines()]));
        return;
      }
      const res = await lib.clearPermNode(ctx.guild.id, node);
      if (!res.ok) {
        await ctx.reply(errorTemplate(t('yetki.ayar_missing_title'), [t('yetki.ayar_missing', { node: `\`${node}\`` })]));
        return;
      }
      await ctx.reply(success(t('yetki.ayar_cleared_title'), [t('yetki.ayar_cleared', { node: `\`${node}\`` })]));
      return;
    }

    // ----------------------------------------------------------------------
    // Rutbe seviyeleri (rank_levels): rol -> seviye. permission.rankLevel: N
    // kosulu icin karar motoru bu eslemeyi kullanir.
    // ----------------------------------------------------------------------
    if (op === 'rutbe' || op === 'rank' || op === 'seviye') {
      const rankLib = await import('../../../core/rankLevels.js');
      const sub = (pieces[0] || 'liste').toLowerCase();
      const roleId = parseRoleId(pieces[1], ctx.guild);

      if (sub === 'liste' || sub === 'list') {
        const levels = await rankLib.getRankLevels(ctx.guild.id);
        const entries = Object.entries(levels).sort((a, b) => b[1] - a[1]);
        const lines = entries.length
          ? entries.map(([id, level]) => t('yetki.ayar_rank_line', { rol: `<@&${id}>`, seviye: level }))
          : [t('yetki.ayar_rank_empty')];
        await ctx.reply(listTemplate({ title: t('yetki.ayar_rank_list_title'), lines }));
        return;
      }

      if (sub === 'ver' || sub === 'ekle' || sub === 'set') {
        const level = Math.floor(Number(pieces[2]));
        if (!roleId || !ctx.guild.roles.cache.has(roleId)) {
          await ctx.reply(errorTemplate(t('yetki.ayar_rank_role_bad_title'), [t('yetki.ayar_rank_role_bad'), ...usageLines()]));
          return;
        }
        if (!Number.isFinite(level) || level < 1 || level > rankLib.MAX_LEVEL) {
          await ctx.reply(errorTemplate(t('yetki.ayar_rank_level_bad_title'), [t('yetki.ayar_rank_level_bad', { max: rankLib.MAX_LEVEL }), ...usageLines()]));
          return;
        }
        const res = await rankLib.setRankLevel(ctx.guild.id, roleId, level);
        if (!res.ok) {
          await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
          return;
        }
        await ctx.reply(success(t('yetki.ayar_rank_saved_title'), [
          t('yetki.ayar_rank_saved', { rol: `<@&${roleId}>`, seviye: level }),
        ]));
        return;
      }

      if (sub === 'al' || sub === 'kaldir' || sub === 'sil') {
        if (!roleId) {
          await ctx.reply(errorTemplate(t('yetki.ayar_rank_role_bad_title'), [t('yetki.ayar_rank_role_bad'), ...usageLines()]));
          return;
        }
        const res = await rankLib.removeRankLevel(ctx.guild.id, roleId);
        if (!res.ok) {
          await ctx.reply(errorTemplate(t('yetki.ayar_rank_missing_title'), [t('yetki.ayar_rank_missing', { rol: `<@&${roleId}>` })]));
          return;
        }
        await ctx.reply(success(t('yetki.ayar_rank_removed_title'), [t('yetki.ayar_rank_removed', { rol: `<@&${roleId}>` })]));
        return;
      }

      await ctx.reply(errorTemplate(t('yetki.ayar_rank_usage_title'), [
        t('yetki.ayar_usage_rutbe'),
        t('yetki.ayar_rank_usage_liste'),
        t('yetki.ayar_rank_usage_al'),
      ]));
      return;
    }

    await ctx.reply(errorTemplate(t('yetki.ayar_usage_title'), usageLines()));
  },
};
