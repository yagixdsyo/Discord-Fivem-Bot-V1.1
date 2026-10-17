/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { getTeam, updateTeam } from '../lib/teams.js';

export default {
  name: 'ekip-patron-ekle',
  aliases: ['ekippatronekle'],
  description: 'Bir ekibe patron atar/değiştirir.',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'ekip', type: 'string', required: true, description: 'Ekip adı veya ID' },
    { name: 'kullanici', type: 'user', required: true, description: 'Yeni patron' },
  ],

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

    const arg = ctx.args.kullanici;
    const user = arg?.user ?? arg;
    const bossIds = (team.boss_ids ?? []).filter((id) => id !== user.id);
    await updateTeam(ctx.guild.id, team.team_id, { patron_id: user.id, boss_ids: bossIds });

    await ctx.reply(
      card({
        emojiKey: 'PATRON',
        title: t('fivem.ekip.patron_set_title'),
        lines: [t('fivem.ekip.patron_set', { ad: `**${team.name}**`, kullanici: `<@${user.id}>` })],
        accent: 'success',
        footer: `\`${team.team_id}\``,
      }),
    );
  },
};
