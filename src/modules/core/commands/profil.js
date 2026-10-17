/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { success } from '../../../ui/templates/index.js';

export default {
  name: 'profil',
  aliases: ['profile'],
  description: 'Kullanici ve sunucu profil bilgisini goruntuler.',
  category: 'Kullanici',
  system: null,
  cooldown: 4,
  permission: { discord: [] },
  args: [{ name: 'kullanici', type: 'user', required: false, description: 'Hedef kullanici (varsayilan: kendisi)' }],
  async run(ctx) {
    const t = ctx.t;
    const arg = ctx.args.kullanici;
    const target = arg?.user ?? arg ?? ctx.user;
    const member = await ctx.guild.members.fetch(target.id).catch(() => null);
    const lines = [
      t('user.profile_title', { kullanici: `<@${target.id}>` }),
      t('user.tag', { tag: target.tag }),
      t('user.id', { id: target.id }),
      t('user.created', { tarih: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>` }),
      member ? t('user.joined', { tarih: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` }) : t('user.not_in_guild'),
      member ? t('user.roles', { roller: member.roles.cache.filter((r) => r.id !== ctx.guild.id).map((r) => r.toString()).slice(0, 10).join(', ') || '-' }) : '',
    ].filter(Boolean);
    await ctx.reply(success(t('user.profile_card'), lines));
  },
};
