/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { resolveTargetGuild } from '../lib/guildResolve.js';
import { setGuildDeactivated } from '../lib/state.js';
import { auditAction } from '../lib/audit.js';
import { success, warn } from '../../ui/templates/index.js';

export default {
  name: 'bot-deaktif',
  description: 'Botu bir sunucuda pasif yapar (komutlar cevap vermez).',
  category: 'Sunucu',
  args: [
    { name: 'sunucu', type: 'string', required: false, description: 'Sunucu ID veya adı' },
    { name: 'sebep', type: 'rest', required: false, description: 'Sebep' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const guild = await resolveTargetGuild(ctx, ctx.args.sunucu, { required: false });
    if (!guild) return;

    const reason = String(ctx.args.sebep ?? '').trim() || null;
    const result = await setGuildDeactivated({ guildId: guild.id, enabled: true, reason, setBy: ctx.user.id });
    if (!result.ok) {
      await ctx.reply(warn(t('owner.db_unavailable'), []));
      return;
    }

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'bot-deaktif',
      target: guild.id,
      guildId: guild.id,
      payload: { sebep: reason },
      t,
    });

    const lines = [t('owner.guild_off.line', { sunucu: guild.name })];
    if (reason) lines.push(t('owner.reason_line', { sebep: reason }));
    await ctx.reply(success(t('owner.guild_off.done'), lines));
  },
};
