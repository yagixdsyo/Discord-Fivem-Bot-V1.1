/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { membersWithRole, runBulkRole } from '../lib/bulkFlow.js';

export default {
  name: 'ekip-toplu-rolal',
  aliases: ['ekiptoplurolal'],
  description: 'Bir role sahip tüm üyelerden başka bir rolü toplu alır.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 15,
  permission: { discord: ['ManageRoles'], node: 'moderation.rol' },
  args: [
    { name: 'kaynak-rol', type: 'role', required: true, description: 'Sahipleri seçilecek rol' },
    { name: 'hedef-rol', type: 'role', required: true, description: 'Alınacak rol' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const kaynak = ctx.args['kaynak-rol'];
    const hedef = ctx.args['hedef-rol'];

    if (kaynak.id === hedef.id) {
      await ctx.reply(errorTemplate(t('moderation.bulk.same_role_title'), [t('moderation.bulk.same_role_body')]));
      return;
    }

    const ids = await membersWithRole(ctx.guild, kaynak.id);
    await runBulkRole(ctx, { role: hedef, userIds: ids, action: 'cikar', source: 'ekip' });
  },
};
