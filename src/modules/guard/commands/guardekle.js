/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success as successTemplate } from '../../../ui/templates/index.js';
import { addProtectedRole, getProtectedRoles } from '../lib/config.js';
import { korumaliListPayload } from '../lib/view.js';

export default {
  name: 'guard-ekle',
  aliases: ['guardekle'],
  description: 'Bir rolü guard korumasına alır.',
  category: 'Guard',
  system: 'guard',
  cooldown: 5,
  permission: { discord: ['Administrator'] },
  args: [{ name: 'rol', type: 'role', required: true, description: 'Korunacak rol' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const role = ctx.args.rol;
    if (!role || role.id === ctx.guild.id) {
      await ctx.reply(errorTemplate(t('guard.protected.invalid_title'), [t('guard.protected.invalid_body')]));
      return;
    }

    const result = await addProtectedRole({ guildId: ctx.guild.id, roleId: role.id, addedBy: ctx.user.id });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('guard.ayar.failed_title'), [t('guard.ayar.failed_body')]));
      return;
    }

    const entries = await getProtectedRoles(ctx.guild.id);
    await ctx.reply(
      successTemplate(t('guard.protected.added_title', { rol: role.name }), [t('guard.protected.added_body')]),
    );
    await ctx.followUp(korumaliListPayload(t, { entries })).catch(() => {});
  },
};
