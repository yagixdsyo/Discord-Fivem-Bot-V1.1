/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';

export default {
  name: 'ekipac',
  aliases: ['ekip-ac'],
  description: 'Yeni bir ekip açar: rol (renk + konum) + kategori + kanallar + sabit panel.',
  category: 'FiveM',
  system: null,
  cooldown: 10,
  permission: { discord: ['ManageRoles', 'ManageChannels'] },
  args: [
    { name: 'ad', type: 'string', required: true, description: 'Ekip adı' },
    { name: 'patron', type: 'user', required: true, description: 'Ekip patronu (boss)' },
    { name: 'sinir', type: 'integer', required: false, description: 'Üye sınırı (0 = sınırsız)' },
    { name: 'renk', type: 'string', required: false, description: 'Rol rengi (#ff0000)' },
    {
      name: 'tür',
      type: 'choice',
      required: false,
      description: 'Ekip türü',
      choices: [
        { name: 'Legal', value: 'legal' },
        { name: 'Illegal', value: 'illegal' },
      ],
    },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const name = String(ctx.args.ad ?? '').trim();
    const patronArg = ctx.args.patron;
    const patron = patronArg?.user ?? patronArg;
    if (!name || !patron) {
      await ctx.reply(errorTemplate(t('fivem.ekip.input_missing_title'), [t('fivem.ekip.input_missing')]));
      return;
    }

    const bossMember = await ctx.guild.members.fetch(patron.id).catch(() => null);
    if (!bossMember) {
      await ctx.reply(errorTemplate(t('fivem.ekip.input_missing_title'), [t('fivem.ekip.input_missing')]));
      return;
    }

    const type = ctx.args.tür ?? 'legal';
    const color = ctx.args.renk ? String(ctx.args.renk).trim() : null;

    const teamLib = await import('../../team/lib/teams.js');
    const settings = await teamLib.getTeamSettings(ctx.guild.id).catch(() => ({ anchorRoleId: null }));

    const team = await teamLib.createTeam({
      guild: ctx.guild,
      name,
      kind: type,
      bossMember,
      limit: Math.max(0, ctx.args.sinir ?? 0),
      color,
      anchorRoleId: settings.anchorRoleId,
      t,
    });

    if (!team) {
      await ctx.reply(errorTemplate(t('fivem.ekip.create_fail_title'), [t('fivem.ekip.create_fail', { sebep: '-' })]));
      return;
    }

    await emitLog(ctx.guild, 'log_olusum_bilgi', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [
        t('fivem.ekip.log_created', { ad: `**${name}**`, tur: t(`fivem.ekip.types.${type}`), patron: `<@${patron.id}>` }),
      ],
      accent: 'success',
    });

    await ctx.reply(
      success(t('fivem.ekip.created_title'), [
        t('fivem.ekip.created', { ad: `**${team.name}**`, kod: `\`${team.team_id}\`` }),
        t('fivem.ekip.created_role', { rol: team.role_id ? `<@&${team.role_id}>` : '-' }),
        t('fivem.ekip.created_patron', { patron: `<@${patron.id}>` }),
        team.panel_channel_id ? t('fivem.ekip.created_panel', { kanal: `<#${team.panel_channel_id}>` }) : null,
      ].filter(Boolean)),
    );
  },
};
