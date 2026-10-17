/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { getTeam, toggleWritingLock } from '../lib/teams.js';

export default {
  name: 'ekip-yazma-kilidi',
  aliases: ['ekipyazmakilidi'],
  description: 'Ekip ticket kanalında yazmayı patron/boss ile sınırlar veya açar.',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageChannels'] },
  args: [
    { name: 'ekip', type: 'string', required: true, description: 'Ekip adı veya ID' },
    {
      name: 'durum',
      type: 'choice',
      required: false,
      description: 'Kilit durumu (boşsa değiştirir)',
      choices: [
        { name: 'Kilitle', value: 'kilit' },
        { name: 'Aç', value: 'acik' },
      ],
    },
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

    const desired = ctx.args.durum === 'kilit' ? true : ctx.args.durum === 'acik' ? false : !team.writing_locked;
    const result = await toggleWritingLock(ctx.guild, team, desired, { actorId: ctx.user.id });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.ekip.lock_fail_title'), [t('fivem.ekip.lock_fail')]));
      return;
    }

    await ctx.reply(
      card({
        emojiKey: desired ? 'KILIT' : 'KILIT_ACIK',
        title: t('fivem.ekip.lock_title'),
        lines: [
          desired
            ? t('fivem.ekip.lock_done', { ad: `**${team.name}**` })
            : t('fivem.ekip.unlock_done', { ad: `**${team.name}**` }),
        ],
        accent: desired ? 'warn' : 'success',
        footer: `\`${team.team_id}\``,
      }),
    );
  },
};
