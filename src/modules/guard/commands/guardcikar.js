/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success as successTemplate } from '../../../ui/templates/index.js';
import { getProtectedRoles, removeProtectedRole } from '../lib/config.js';
import { korumaliListPayload } from '../lib/view.js';

export default {
  name: 'guard-cikar',
  aliases: ['guardcikar'],
  description: 'Bir rolü guard korumasından çıkarır.',
  category: 'Guard',
  system: 'guard',
  cooldown: 5,
  permission: { discord: ['Administrator'] },
  args: [{ name: 'rol', type: 'role', required: true, description: 'Koruma çıkarılacak rol' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const role = ctx.args.rol;
    const result = await removeProtectedRole(ctx.guild.id, role.id);
    if (!result.ok || !result.removed) {
      await ctx.reply(errorTemplate(t('guard.protected.not_found_title'), [t('guard.protected.not_found_body')]));
      return;
    }

    const entries = await getProtectedRoles(ctx.guild.id);
    await ctx.reply(
      successTemplate(t('guard.protected.removed_title', { rol: role.name }), [t('guard.protected.removed_body')]),
    );
    await ctx.followUp(korumaliListPayload(t, { entries })).catch(() => {});
  },
};
