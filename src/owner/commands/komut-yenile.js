/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { deployCommands } from '../../core/commandDeployer.js';
import { auditAction } from '../lib/audit.js';
import { success, warn } from '../../ui/templates/index.js';

export default {
  name: 'komut-yenile',
  description: 'Slash komutlarını yeniden kaydeder.',
  category: 'Sistem',

  async run(ctx) {
    const t = ctx.t;

    let result;
    try {
      result = await deployCommands(ctx.client, ctx.registry.commandList, {
        devGuildId: ctx.config.devGuildId,
        force: true,
      });
    } catch (err) {
      await ctx.reply(warn(t('owner.deploy.failed'), [`\`${err?.message ?? err}\``]));
      return;
    }

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'komut-yenile',
      payload: { global: result.global, guild: result.guild, prefixOnly: result.prefixOnly },
      t,
    });

    await ctx.reply(
      success(t('owner.deploy.done'), [
        t('owner.deploy.result', { global: result.global, guild: result.guild }),
        result.prefixOnly > 0 ? t('owner.deploy.prefix_only', { adet: result.prefixOnly }) : null,
      ].filter(Boolean)),
    );
  },
};
