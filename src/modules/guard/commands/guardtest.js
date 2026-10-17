/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { GUARD_MODULES, getGuardConfig, isSafeActor, moduleDef } from '../lib/config.js';
import { guardTestPayload, punishLabel } from '../lib/view.js';

export default {
  name: 'guard-test',
  aliases: ['guardtest'],
  description: 'Guard’ın bir modülde nasıl davranacağını simüle eder (ceza uygulamaz).',
  category: 'Guard',
  system: 'guard',
  cooldown: 5,
  permission: { discord: ['Administrator'] },
  args: [
    {
      name: 'modul',
      type: 'choice',
      required: true,
      description: 'Test edilecek modül',
      choices: GUARD_MODULES.map((def) => ({ name: def.name, value: def.key })),
    },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const moduleKey = String(ctx.args.modul ?? '').toLowerCase();
    const def = moduleDef(moduleKey);
    if (!def) {
      await ctx.reply(errorTemplate(t('guard.ayar.unknown_title'), [t('guard.ayar.unknown_body', { modul: moduleKey })]));
      return;
    }

    const config = await getGuardConfig(ctx.guild.id);
    const cfg = config.modules[moduleKey];
    const safeInfo = await isSafeActor({
      guildId: ctx.guild.id,
      actorId: ctx.user.id,
      moduleKey,
      guildOwnerId: ctx.guild.ownerId,
      clientUserId: ctx.client?.user?.id ?? null,
      botOwnerIds: ctx.config?.ownerIds ?? [],
    });

    let verdict;
    if (!cfg.enabled) verdict = t('guard.test.verdict_disabled');
    else if (ctx.guild.ownerId === ctx.user.id) verdict = t('guard.test.verdict_owner');
    else if (safeInfo.safe) verdict = t('guard.test.verdict_safe', { kademe: safeInfo.tier ?? 4 });
    else verdict = t('guard.test.verdict_punish', { ceza: punishLabel(t, cfg.punish) });

    await ctx.reply(
      guardTestPayload(t, {
        def,
        cfg,
        actorId: ctx.user.id,
        verdict,
      }),
    );
  },
};
