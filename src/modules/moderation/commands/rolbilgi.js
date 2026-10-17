/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { hasDangerousPerms } from '../../guard/lib/punish.js';
import { roleErrorCard } from '../lib/roles.js';
import { roleInfoPayload } from '../lib/view.js';

export default {
  name: 'rolbilgi',
  aliases: ['rol-bilgi'],
  description: 'Bir rolün bilgilerini gösterir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  permission: { discord: ['ManageRoles'] },
  args: [{ name: 'rol', type: 'role', required: true, description: 'Bilgisi gösterilecek rol' }],

  async run(ctx) {
    const t = ctx.t;
    const role = ctx.args.rol;

    let memberCount = role.members?.size ?? 0;
    if (memberCount === 0) {
      await ctx.guild.members.fetch().catch(() => {});
      memberCount = role.members?.size ?? 0;
    }

    const dangerous = hasDangerousPerms(role.permissions?.bitfield);
    let payload;
    try {
      payload = roleInfoPayload(t, { role, memberCount, dangerous });
    } catch {
      await ctx.reply(roleErrorCard(t, 'rol_yok'));
      return;
    }
    await ctx.reply(payload);
  },
};
