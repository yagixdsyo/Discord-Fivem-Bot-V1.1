/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getModule } from '../../core/moduleRegistry.js';
import { setModuleEnabledScoped } from '../lib/state.js';
import { auditAction } from '../lib/audit.js';
import { resolveScopeChoice } from '../lib/guildResolve.js';
import { info, success, warn } from '../../ui/templates/index.js';

export default {
  name: 'modül-kapat',
  aliases: ['modul-kapat'],
  description: 'Bir modülü global veya sunucu bazında kapatır.',
  category: 'Sistem',
  args: [
    { name: 'modul', type: 'string', required: true, description: 'Modül kimliği' },
    { name: 'kapsam', type: 'string', required: false, description: 'global | sunucu ID | sunucu adı' },
    { name: 'sebep', type: 'rest', required: false, description: 'Sebep' },
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

    const reason = String(ctx.args.sebep ?? '').trim() || null;
    const result = await setModuleEnabledScoped({
      moduleId: def.id,
      scope: scopeRes.scope,
      enabled: false,
      by: ctx.user.id,
      reason,
    });

    if (!result.ok) {
      if (result.error === 'core_modul_kapatilamaz') {
        await ctx.reply(warn(t('owner.module.core_locked', { modul: def.name }), []));
        return;
      }
      await ctx.reply(warn(t('owner.db_unavailable'), []));
      return;
    }

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'modul-kapat',
      target: def.id,
      guildId: scopeRes.guildId,
      payload: { kapsam: scopeRes.label, sebep: reason },
      t,
    });

    const lines = [t('owner.module.off_line', { modul: def.name, kapsam: scopeRes.label })];
    if (reason) lines.push(t('owner.reason_line', { sebep: reason }));
    await ctx.reply(success(t('owner.module.off_done'), lines));
  },
};
