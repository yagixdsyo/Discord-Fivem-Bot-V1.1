/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { getOlusum, searchOlusums } from '../lib/olusum.js';
import { olusumInfoPayload } from '../lib/view.js';

export default {
  name: 'oluşum-bilgi',
  aliases: ['olusum-bilgi'],
  description: 'Bir oluşumun detaylarını ve üye sayısını gösterir.',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'olusum', type: 'string', required: false, description: 'Oluşum adı/ID (boşsa listeyi kısaca gösterir)' },
    { name: 'rol', type: 'role', required: false, description: 'Oluşum rolü ile arama' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const key = ctx.args.olusum ? String(ctx.args.olusum).trim() : null;
    const role = ctx.args.rol ?? null;

    if (!key && !role) {
      const items = await searchOlusums(ctx.guild.id, { active: true, limit: 25 });
      if (items.length === 0) {
        await ctx.reply(errorTemplate(t('fivem.olusum.none_title'), [t('fivem.olusum.none')]));
        return;
      }
      const lines = items.slice(0, 20).map((doc) => t('fivem.olusum.brief_line', { ad: `**${doc.name}**`, rol: `<@&${doc.role_id}>` }));
      await ctx.reply(card({ emojiKey: 'OLUSUM', title: t('fivem.olusum.brief_title'), lines, accent: 'primary' }));
      return;
    }

    const doc =
      (key ? await getOlusum(ctx.guild.id, { olusumId: key }) : null) ??
      (key ? await getOlusum(ctx.guild.id, { name: key }) : null) ??
      (role ? await getOlusum(ctx.guild.id, { roleId: role.id }) : null);

    if (!doc) {
      await ctx.reply(errorTemplate(t('fivem.olusum.not_found_title'), [t('fivem.olusum.not_found', { olusum: key ?? role?.id ?? '-' })]));
      return;
    }

    const roleObj = ctx.guild.roles.cache.get(doc.role_id) ?? (await ctx.guild.roles.fetch(doc.role_id).catch(() => null));
    const memberCount = roleObj?.members?.size ?? null;

    await ctx.reply(olusumInfoPayload(t, { doc, memberCount, roleName: roleObj?.name ?? null }));
  },
};
