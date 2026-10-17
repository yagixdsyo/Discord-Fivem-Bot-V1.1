/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { removeBlacklist } from '../lib/state.js';
import { auditAction } from '../lib/audit.js';
import { resolveTargetGuild } from '../lib/guildResolve.js';
import { info, success, warn } from '../../ui/templates/index.js';

export default {
  name: 'kara-liste-çıkar',
  aliases: ['kara-liste-cikar'],
  description: 'Bir sunucuyu kara listeden çıkarır.',
  category: 'Sunucu',
  args: [{ name: 'sunucu', type: 'string', required: true, description: 'Sunucu ID veya adı' }],

  async run(ctx) {
    const t = ctx.t;
    const raw = String(ctx.args.sunucu ?? '').trim();

    let guildId = null;
    let guildName = null;

    if (/^\d{15,25}$/.test(raw)) {
      guildId = raw;
      guildName = ctx.client.guilds.cache.get(raw)?.name ?? null;
    } else {
      const guild = await resolveTargetGuild(ctx, raw);
      if (!guild) return;
      guildId = guild.id;
      guildName = guild.name;
    }

    const result = await removeBlacklist(guildId);
    if (!result.ok) {
      await ctx.reply(info(t('owner.blacklist.not_found', { id: guildId }), []));
      return;
    }

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'kara-liste-cikar',
      target: guildId,
      guildId,
      t,
    });

    await ctx.reply(
      success(t('owner.blacklist.removed'), [t('owner.guild_off.line', { sunucu: guildName ?? guildId })]),
    );
  },
};
