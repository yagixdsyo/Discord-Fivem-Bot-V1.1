/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { setCommandDisabled } from '../lib/state.js';
import { auditAction } from '../lib/audit.js';
import { resolveScopeChoice } from '../lib/guildResolve.js';
import { info, success, warn } from '../../ui/templates/index.js';

export default {
  name: 'komut-aç',
  aliases: ['komut-ac'],
  description: 'Kapatılmış bir komutu yeniden açar.',
  category: 'Sistem',
  args: [
    { name: 'komut', type: 'string', required: true, description: 'Komut adı' },
    { name: 'kapsam', type: 'string', required: false, description: 'global | sunucu ID | sunucu adı' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const name = String(ctx.args.komut ?? '').toLowerCase().replace(/^\//, '');
    const cmd = ctx.registry.commands.get(name) ?? ctx.registry.aliases?.get(name) ?? null;
    if (!cmd) {
      await ctx.reply(info(t('owner.command_not_found', { komut: name }), []));
      return;
    }

    const scopeRes = await resolveScopeChoice(ctx, ctx.args.kapsam);
    if (!scopeRes.ok) return;

    const result = await setCommandDisabled({
      command: cmd.name,
      scope: scopeRes.scope,
      enabled: true,
      setBy: ctx.user.id,
    });
    if (!result.ok) {
      await ctx.reply(warn(t('owner.db_unavailable'), []));
      return;
    }

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'komut-ac',
      target: cmd.name,
      guildId: scopeRes.guildId,
      payload: { kapsam: scopeRes.label },
      t,
    });

    await ctx.reply(
      success(t('owner.cmd_on.done'), [t('owner.cmd_on.line', { komut: cmd.name, kapsam: scopeRes.label })]),
    );
  },
};
