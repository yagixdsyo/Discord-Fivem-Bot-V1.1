/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { getGuardConfig, moduleDef, PUNISH_TYPES, setGuardModuleSetting } from '../lib/config.js';
import { guardAyarPayload } from '../lib/view.js';

export default {
  name: 'guard-ayar',
  aliases: ['guardayar'],
  description: 'Guard modül ayarlarını gösterir veya günceller.',
  category: 'Guard',
  system: 'guard',
  cooldown: 5,
  permission: { discord: ['Administrator'] },
  args: [
    {
      name: 'modul',
      type: 'string',
      required: true,
      description: 'Modül kimliği (guard-durum listesindeki anahtarlar)',
    },
    {
      name: 'ceza',
      type: 'choice',
      required: false,
      description: 'Ceza türü',
      choices: PUNISH_TYPES.map((value) => ({ name: value, value })),
    },
    { name: 'limit', type: 'integer', required: false, description: 'Eşik: pencere içinde kaç olayda ceza' },
    { name: 'pencere', type: 'integer', required: false, description: 'Eşik penceresi (saniye)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const moduleKey = String(ctx.args.modul ?? '').trim().toLowerCase();
    const def = moduleDef(moduleKey);
    if (!def) {
      await ctx.reply(
        errorTemplate(t('guard.ayar.unknown_title'), [
          t('guard.ayar.unknown_body', { modul: moduleKey }),
          t('guard.ayar.unknown_hint'),
        ]),
      );
      return;
    }

    const patch = {};
    if (ctx.args.ceza !== undefined && ctx.args.ceza !== null) patch.punish = String(ctx.args.ceza);
    if (ctx.args.limit !== undefined && ctx.args.limit !== null) patch.limit = Math.max(1, Number(ctx.args.limit) || 1);
    if (ctx.args.pencere !== undefined && ctx.args.pencere !== null) patch.window = Math.max(5, Number(ctx.args.pencere) || 5);

    if (Object.keys(patch).length > 0) {
      const result = await setGuardModuleSetting(ctx.guild.id, moduleKey, patch);
      if (!result.ok) {
        await ctx.reply(errorTemplate(t('guard.ayar.failed_title'), [t('guard.ayar.failed_body')]));
        return;
      }
    }

    const config = await getGuardConfig(ctx.guild.id, { fresh: true });
    await ctx.reply(guardAyarPayload(t, { moduleKey, cfg: config.modules[moduleKey] }));
  },
};
