/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { resolveTargetGuild } from '../lib/guildResolve.js';
import { setGuildDeactivated } from '../lib/state.js';
import { auditAction } from '../lib/audit.js';
import { success, warn } from '../../ui/templates/index.js';

export default {
  name: 'bot-aktif',
  description: 'Bir sunucudaki pasif durumunu kaldırır.',
  category: 'Sunucu',
  args: [{ name: 'sunucu', type: 'string', required: false, description: 'Sunucu ID veya adı' }],

  async run(ctx) {
    const t = ctx.t;
    const guild = await resolveTargetGuild(ctx, ctx.args.sunucu, { required: false });
    if (!guild) return;

    const result = await setGuildDeactivated({ guildId: guild.id, enabled: false, setBy: ctx.user.id });
    if (!result.ok) {
      await ctx.reply(warn(t('owner.db_unavailable'), []));
      return;
    }

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'bot-aktif',
      target: guild.id,
      guildId: guild.id,
      t,
    });

    await ctx.reply(success(t('owner.guild_on.done'), [t('owner.guild_on.line', { sunucu: guild.name })]));
  },
};
