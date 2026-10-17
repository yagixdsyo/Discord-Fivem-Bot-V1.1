/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { list as listTemplate, error as errorTemplate, success, card } from '../../../ui/templates/index.js';

function parseMention(value) {
  const m = String(value || '').match(/<@!?(\d+)>/);
  return m ? m[1] : ( /^\d+$/.test(value || '') ? value : null );
}

export default {
  name: 'ekip',
  aliases: [],
  description: 'Ekip ac/kapat/guncelle/sorgu/liste/senkron/senkron-tumu/ayar/panel/basvuru-panel komutlari.',
  category: 'Ekip',
  system: 'ekip',
  cooldown: 5,
  permission: { discord: ['ManageGuild', 'ManageRoles'], node: 'team.manage' },
  args: [{ name: 'islem', type: 'string', required: true, description: 'ac|kapat|guncelle|sorgu|liste|senkron|senkron-tumu|ayar|panel|basvuru-panel' },
         { name: 'parametre', type: 'rest', required: false, description: 'Parametreler (isim:, boss:, limit:, renk:, tur: destekli)' }],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/teams.js');
    const op = String(ctx.args.islem || '').toLowerCase();
    const raw = String(ctx.args.parametre || '').trim();
    const pieces = raw.split(/\s+/).filter(Boolean);

    if (op === 'liste') {
      const kind = ['legal', 'illegal'].includes(pieces[0]) ? pieces[0] : null;
      const rows = await lib.listTeams(ctx.guild.id, { kind });
      if (!rows.length) {
        await ctx.reply(listTemplate({ title: t('team.list_title'), lines: [t('team.list_empty')] }));
        return;
      }
      const lines = rows.map((x) => t('team.list_line', { id: x.team_id, ad: x.name, tur: x.kind, rolsayi: x.member_ids?.length ?? 0 }));
      await ctx.reply(listTemplate({ title: t('team.list_title'), lines }));
      return;
    }

    if (op === 'sorgu') {
      const team = await lib.getTeam(ctx.guild.id, pieces[0] || '');
      if (!team) {
        await ctx.reply(errorTemplate(t('team.not_found_title'), [t('team.not_found', { id: pieces[0] || '-' })]));
        return;
      }
      const { buildTeamInfoCard } = await import('../lib/panel.js');
      await ctx.reply(buildTeamInfoCard(t, team));
      return;
    }

    if (op === 'ac' || op === 'olustur') {
      const namedName = raw.match(/(?:isim|ad):"?([^"\s]+)"?/i)?.[1] ?? null;
      const positionalName =
        pieces.find((p) => !p.includes(':') && !/^<@!?\d+>$/.test(p) && !/^\d+$/.test(p) && !/^#[0-9A-Fa-f]{6}$/.test(p)) ?? null;
      const name = namedName ?? positionalName ?? 'Yeni Ekip';

      const bossMatch = raw.match(/boss:(?:<@!?(\d+)>|(\d+))/i);
      const bossId = bossMatch ? bossMatch[1] ?? bossMatch[2] : parseMention(pieces[1] ?? '');
      if (!bossId) {
        await ctx.reply(errorTemplate(t('team.boss_need_title'), [t('team.boss_need')]));
        return;
      }
      const bossMember = await ctx.guild.members.fetch(bossId).catch(() => null);
      if (!bossMember) {
        await ctx.reply(errorTemplate(t('team.boss_need_title'), [t('team.boss_need')]));
        return;
      }

      const limitMatch = raw.match(/limit:(\d+)/i);
      const positionalLimit = pieces.find((p) => /^\d+$/.test(p) && p !== bossId);
      const limit = limitMatch ? Number(limitMatch[1]) : positionalLimit ? Number(positionalLimit) : 0;

      const color = raw.match(/renk:(#[0-9A-Fa-f]{6})/i)?.[1] ?? pieces.find((p) => /^#[0-9A-Fa-f]{6}$/.test(p)) ?? null;
      const kind = raw.match(/tur:(legal|illegal)/i)?.[1] ?? (pieces.includes('illegal') ? 'illegal' : 'legal');

      const settings = await lib.getTeamSettings(ctx.guild.id).catch(() => ({ anchorRoleId: null, language: 'tr' }));
      const team = await lib.createTeam({ guild: ctx.guild, name, kind, bossMember, limit, color, anchorRoleId: settings.anchorRoleId, t });
      const createdLines = [
        t('team.created', { ad: team.name, id: team.team_id, rol: team.role_id ? `<@&${team.role_id}>` : '-' }),
      ];
      if (team.panel_channel_id) createdLines.push(t('team.created_panel', { kanal: `<#${team.panel_channel_id}>` }));
      await ctx.reply(success(t('team.created_title'), createdLines));
      return;
    }

    if (op === 'kapat' || op === 'sil') {
      const teamId = pieces[0];
      const confirmWord = pieces[1] || '';
      const team = await lib.getTeam(ctx.guild.id, teamId);
      if (!team) {
        await ctx.reply(errorTemplate(t('team.not_found_title'), [t('team.not_found', { id: teamId || '-' })]));
        return;
      }
      if (confirmWord.toUpperCase() !== 'ONAY') {
        await ctx.reply(errorTemplate(t('team.close_need_confirm_title'), [t('team.close_need_confirm', { id: teamId })]));
        return;
      }
      await lib.closeTeam({ team, guild: ctx.guild });
      await ctx.reply(success(t('team.closed_title'), [t('team.closed_line', { id: teamId })]));
      return;
    }

    if (op === 'guncelle') {
      const teamId = pieces[0];
      if (!pieces[0]) { await ctx.reply(errorTemplate(t('team.id_need_title'), [t('team.id_need')])); return; }
      let patch = {};
      const joined = pieces.join(' ');
      const nameMatch = joined.match(/isim:"?([^"\s]+)"?/i);
      const bossMatch = joined.match(/boss:(?:<@!?(\d+)>|(\d+))/i);
      const limitMatch = joined.match(/limit:(\d+)/i);
      const colorMatch = joined.match(/renk:(#[0-9A-Fa-f]{6})/i);
      const kindMatch = joined.match(/tur:(legal|illegal)/i);
      if (nameMatch) patch.name = nameMatch[1];
      if (bossMatch) patch.boss_id = bossMatch[1] || bossMatch[2];
      if (limitMatch) patch.member_limit = Number(limitMatch[1]);
      if (colorMatch) patch.color = colorMatch[1];
      if (kindMatch) patch.kind = kindMatch[1];
      if (Object.keys(patch).length === 0) {
        await ctx.reply(errorTemplate(t('team.update_need_patch_title'), [t('team.update_need_patch')]));
        return;
      }
      const done = await lib.updateTeam({ guild: ctx.guild, guildId: ctx.guild.id, teamId, patch });
      if (!done) {
        await ctx.reply(errorTemplate(t('team.not_found_title'), [t('team.not_found', { id: teamId })]));
        return;
      }
      await lib.refreshTeamPanel({ guild: ctx.guild, team: done, t }).catch(() => {});
      await ctx.reply(success(t('team.updated_title'), [t('team.updated', { id: teamId })]));
      return;
    }

    if (op === 'senkron') {
      const teamId = pieces[0];
      const team = await lib.getTeam(ctx.guild.id, teamId);
      if (!team) { await ctx.reply(errorTemplate(t('team.not_found_title'), [t('team.not_found', { id: teamId || '-' })])); return; }
      const result = await lib.teamSync({ guild: ctx.guild, team, cfg: { removeExtra: false } });
      const lines = [t('team.sync_summary', { id: teamId, eklenen: result.added, cikarilan: result.removed }), `Rolde olup DB'de olmayan: ${result.missing.length ? result.missing.map((x) => `<@${x}>`).join(', ') : '-'}`];
      await ctx.reply(success(t('team.sync_title'), lines));
      return;
    }

    if (op === 'senkron-tumu' || op === 'sync-all') {
      const reports = await lib.teamSyncAll(ctx.guild, { removeExtra: false });
      const lines = reports.map((r) => t('team.sync_all_line', { ad: r.team_name, eklenen: r.added, cikarilan: r.cikarilan }));
      if (!lines.length) { await ctx.reply(success(t('team.sync_all_title'), [t('team.list_empty')])); return; }
      await ctx.reply(success(t('team.sync_all_title'), lines));
      return;
    }

    if (op === 'ayar') {
      const settings = await lib.getTeamSettings(ctx.guild.id).catch(() => ({ anchorRoleId: null }));
      if (!pieces[0]) {
        await ctx.reply(card({
          emojiKey: 'AYAR',
          title: t('team.settings_title', { sunucu: ctx.guild.name }),
          lines: [
            `**${t('team.settings_anchor_label')}:** ${settings.anchorRoleId ? `<@&${settings.anchorRoleId}>` : t('team.settings_anchor_none')}`,
          ],
          accent: 'primary',
          footer: t('team.settings_footer'),
        }));
        return;
      }
      const roleId = parseMention(pieces[0]);
      const role = roleId
        ? ctx.guild.roles.cache.get(roleId) ?? (await ctx.guild.roles.fetch(roleId).catch(() => null))
        : null;
      if (!role) {
        await ctx.reply(errorTemplate(t('team.settings_anchor_need_title'), [t('team.settings_anchor_need')]));
        return;
      }
      const me = ctx.guild.members.me;
      if (me && me.roles.highest.position <= role.position) {
        await ctx.reply(errorTemplate(t('team.settings_anchor_high_title'), [t('team.settings_anchor_high')]));
        return;
      }
      await lib.setTeamSettings(ctx.guild.id, { anchorRoleId: role.id });
      await ctx.reply(success(t('team.settings_anchor_set_title'), [t('team.settings_anchor_set', { rol: `<@&${role.id}>` })]));
      return;
    }

    if (op === 'panel') {
      const team = await lib.getTeam(ctx.guild.id, pieces[0] || '');
      if (!team) {
        await ctx.reply(errorTemplate(t('team.not_found_title'), [t('team.not_found', { id: pieces[0] || '-' })]));
        return;
      }
      const result = await lib.refreshTeamPanel({ guild: ctx.guild, team, t });
      if (!result.ok) {
        await ctx.reply(errorTemplate(t('team.panel_refreshed_title'), [t('team.panel_failed')]));
        return;
      }
      await ctx.reply(success(t('team.panel_refreshed_title'), [result.posted ? t('team.panel_reposted') : t('team.panel_refreshed')]));
      return;
    }

    if (op === 'basvuru-panel' || op === 'basvurupanel') {
      const channelId = parseMention(pieces[0] ?? '');
      const channel = channelId
        ? ctx.guild.channels.cache.get(channelId) ?? (await ctx.guild.channels.fetch(channelId).catch(() => null))
        : ctx.channel ?? null;
      if (!channel?.send) {
        await ctx.reply(errorTemplate(t('team.apply_channel_need_title'), [t('team.apply_channel_need')]));
        return;
      }
      const { buildApplyPanel } = await import('../lib/apply.js');
      const teams = (await lib.listTeams(ctx.guild.id)).filter((x) => x.application_open !== false);
      const sent = await channel.send(buildApplyPanel(t, { teams })).catch(() => null);
      if (!sent) {
        await ctx.reply(errorTemplate(t('team.apply_channel_need_title'), [t('team.apply_channel_need')]));
        return;
      }
      await ctx.reply(success(t('team.apply_panel_posted_title'), [t('team.apply_panel_posted', { kanal: `<#${channel.id}>`, sayi: teams.length })]));
      return;
    }

    await ctx.reply(errorTemplate(t('team.invalid_action_title'), [t('team.invalid_action')]));
  },
};
