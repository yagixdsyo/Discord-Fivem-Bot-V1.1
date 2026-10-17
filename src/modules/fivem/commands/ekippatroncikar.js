/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { getTeam, updateTeam } from '../lib/teams.js';

export default {
  name: 'ekip-patron-çıkar',
  aliases: ['ekippatroncikar'],
  description: 'Bir ekibin patronunu kaldırır.',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [{ name: 'ekip', type: 'string', required: true, description: 'Ekip adı veya ID' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const key = String(ctx.args.ekip ?? '').trim();
    const team = (await getTeam(ctx.guild.id, { teamId: key })) ?? (await getTeam(ctx.guild.id, { name: key }));
    if (!team || !team.active) {
      await ctx.reply(errorTemplate(t('fivem.ekip.not_found_title'), [t('fivem.ekip.not_found', { ekip: key })]));
      return;
    }
    if (!team.patron_id) {
      await ctx.reply(errorTemplate(t('fivem.ekip.no_patron_title'), [t('fivem.ekip.no_patron', { ad: `**${team.name}**` })]));
      return;
    }

    const oldPatron = team.patron_id;
    await updateTeam(ctx.guild.id, team.team_id, { patron_id: null });
    await ctx.reply(
      card({
        emojiKey: 'PATRON',
        title: t('fivem.ekip.patron_removed_title'),
        lines: [t('fivem.ekip.patron_removed', { ad: `**${team.name}**`, kullanici: `<@${oldPatron}>` })],
        accent: 'warn',
        footer: `\`${team.team_id}\``,
      }),
    );
  },
};
