/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { listTeams, updateTeam } from '../lib/teams.js';

export default {
  name: 'ekip-başvuru',
  aliases: ['ekip-basvuru'],
  description: 'Legal/illegal ekiplerinin başvuru durumunu açar veya kapatır.',
  category: 'FiveM',
  system: null,
  cooldown: 10,
  permission: { discord: ['ManageRoles'] },
  args: [
    {
      name: 'durum',
      type: 'choice',
      required: true,
      description: 'Başvuru durumu',
      choices: [
        { name: 'Aç', value: 'ac' },
        { name: 'Kapat', value: 'kapat' },
      ],
    },
    {
      name: 'tür',
      type: 'choice',
      required: true,
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

    const open = ctx.args.durum === 'ac';
    const type = ctx.args.tür;
    const teams = await listTeams(ctx.guild.id, { type, active: true, limit: 200 });

    let updated = 0;
    for (const team of teams) {
      await updateTeam(ctx.guild.id, team.team_id, { basvuru_acik: open });
      updated += 1;
    }

    await ctx.reply(
      card({
        emojiKey: 'BASVURU',
        title: t('fivem.ekip.basvuru_title'),
        lines: [
          t(open ? 'fivem.ekip.basvuru_opened' : 'fivem.ekip.basvuru_closed', {
            tur: t(`fivem.ekip.types.${type}`),
            adet: `**${updated}**`,
          }),
        ],
        accent: open ? 'success' : 'warn',
      }),
    );
  },
};
