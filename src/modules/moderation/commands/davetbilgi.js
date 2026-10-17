/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { invitedByUser, inviteCount, inviterOfUser } from '../lib/invites.js';
import { inviteInfoPayload } from '../lib/view.js';

export default {
  name: 'davet-bilgi',
  aliases: ['davetbilgi', 'davet'],
  description: 'Bir kullanıcının davet bilgilerini gösterir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  args: [{ name: 'kullanici', type: 'user', required: false, description: 'Kullanıcı (boşsa kendin)' }],

  async run(ctx) {
    const t = ctx.t;
    const target = ctx.args.kullanici;
    const targetUser = target?.user ?? target ?? ctx.user;

    const [total, inviter, invited] = await Promise.all([
      inviteCount(ctx.guild.id, targetUser.id).catch(() => 0),
      inviterOfUser(ctx.guild.id, targetUser.id).catch(() => null),
      invitedByUser(ctx.guild.id, targetUser.id).catch(() => []),
    ]);

    await ctx.reply(
      inviteInfoPayload(t, {
        userTag: targetUser.username,
        userId: targetUser.id,
        total,
        inviterId: inviter?.inviter_id ?? null,
        invited,
      }),
    );
  },
};
