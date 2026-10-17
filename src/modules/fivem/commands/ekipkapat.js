/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { confirm as confirmTemplate, error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { emitLog } from '../../logging/lib/emit.js';
import { runConfirm } from '../../moderation/lib/uiFlow.js';

export default {
  name: 'ekipkapat',
  aliases: ['ekip-kapat'],
  description: 'Bir ekibi kapatır: kanallar ve rol silinir (onaylı).',
  category: 'FiveM',
  system: null,
  cooldown: 10,
  permission: { discord: ['ManageRoles', 'ManageChannels'] },
  args: [{ name: 'ekip', type: 'string', required: true, description: 'Ekip adı veya ID' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const key = String(ctx.args.ekip ?? '').trim();
    const teamLib = await import('../../team/lib/teams.js');
    const team = await teamLib.resolveTeam(ctx.guild.id, key);
    if (!team || team.closed) {
      await ctx.reply(errorTemplate(t('fivem.ekip.not_found_title'), [t('fivem.ekip.not_found', { ekip: key })]));
      return;
    }

    const ownerId = ctx.user.id;
    const payload = confirmTemplate({
      title: t('fivem.ekip.close_confirm_title'),
      description: [t('fivem.ekip.close_confirm_body', { ad: `**${team.name}**`, rol: `<@&${team.role_id}>` })],
      confirmId: `ekipkapatonay:${ownerId}`,
      cancelId: `ekipkapitaiptal:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });
    const confirmed = await runConfirm(ctx, {
      payload,
      ownerId,
      confirmId: `ekipkapatonay:${ownerId}`,
      cancelId: `ekipkapitaiptal:${ownerId}`,
    });
    if (!confirmed) return;

    await teamLib.closeTeam({ guild: ctx.guild, team });

    await emitLog(ctx.guild, 'log_olusum_bilgi', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [t('fivem.ekip.log_closed', { ad: `**${team.name}**` })],
      accent: 'warn',
    });

    await ctx.followUp(
      card({
        emojiKey: 'EKIP',
        title: t('fivem.ekip.closed_title'),
        lines: [t('fivem.ekip.closed_line', { ad: `**${team.name}**` })],
        accent: 'warn',
        footer: `\`${team.team_id}\``,
      }),
    );
  },
};
