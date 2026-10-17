/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getModule } from '../../core/moduleRegistry.js';
import { setModuleEnabledScoped } from '../lib/state.js';
import { auditAction } from '../lib/audit.js';
import { resolveScopeChoice } from '../lib/guildResolve.js';
import { info, success, warn } from '../../ui/templates/index.js';

export default {
  name: 'modül-aç',
  aliases: ['modul-ac'],
  description: 'Kapatılmış bir modülü yeniden açar.',
  category: 'Sistem',
  args: [
    { name: 'modul', type: 'string', required: true, description: 'Modül kimliği' },
    { name: 'kapsam', type: 'string', required: false, description: 'global | sunucu ID | sunucu adı' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const moduleId = String(ctx.args.modul ?? '').toLowerCase();
    const def = getModule(moduleId);
    if (!def) {
      await ctx.reply(info(t('owner.module_not_found', { modul: moduleId }), []));
      return;
    }

    const scopeRes = await resolveScopeChoice(ctx, ctx.args.kapsam);
    if (!scopeRes.ok) return;

    const result = await setModuleEnabledScoped({
      moduleId: def.id,
      scope: scopeRes.scope,
      enabled: true,
      by: ctx.user.id,
    });

    if (!result.ok) {
      await ctx.reply(warn(t('owner.db_unavailable'), []));
      return;
    }

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'modul-ac',
      target: def.id,
      guildId: scopeRes.guildId,
      payload: { kapsam: scopeRes.label },
      t,
    });

    await ctx.reply(
      success(t('owner.module.on_done'), [
        t('owner.module.on_line', { modul: def.name, kapsam: scopeRes.label }),
      ]),
    );
  },
};
