/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { getTeam, updateTeam } from '../lib/teams.js';

export default {
  name: 'ekip-boss-ekle',
  aliases: ['ekipbossekle'],
  description: 'Bir ekibe boss (yönetici) ekler.',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'ekip', type: 'string', required: true, description: 'Ekip adı veya ID' },
    { name: 'kullanici', type: 'user', required: true, description: 'Eklenecek kullanıcı' },
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
    if (team.patron_id === user.id) {
      await ctx.reply(errorTemplate(t('fivem.ekip.already_patron_title'), [t('fivem.ekip.already_patron')]));
      return;
    }

    const bossIds = new Set(team.boss_ids ?? []);
    if (bossIds.has(user.id)) {
      await ctx.reply(errorTemplate(t('fivem.ekip.already_boss_title'), [t('fivem.ekip.already_boss', { kullanici: `<@${user.id}>` })]));
      return;
    }
    bossIds.add(user.id);
    await updateTeam(ctx.guild.id, team.team_id, { boss_ids: [...bossIds] });

    await ctx.reply(
      card({
        emojiKey: 'BOSS',
        title: t('fivem.ekip.boss_added_title'),
        lines: [t('fivem.ekip.boss_added', { ad: `**${team.name}**`, kullanici: `<@${user.id}>` })],
        accent: 'success',
        footer: `\`${team.team_id}\``,
      }),
    );
  },
};
