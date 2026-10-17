/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { runDmFlow } from '../lib/flow.js';

export default {
  name: 'dm-duyuru-rol',
  aliases: [],
  description: 'Bir roldeki tüm üyelere DM duyurusu gönderir.',
  category: 'DM Duyuru',
  system: 'dm_duyuru',
  cooldown: 30,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'rol', type: 'role', required: true, description: 'Hedef rol' },
    { name: 'mesaj', type: 'rest', required: true, description: 'Gönderilecek mesaj' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }
    const role = ctx.args.rol;
    await runDmFlow(ctx, {
      source: 'rol',
      roleId: role.id,
      sourceLabel: t('announce.sources.role', { rol: `@${role.name}` }),
    });
  },
};
