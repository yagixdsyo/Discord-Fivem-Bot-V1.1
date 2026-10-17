/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';
import { scanYetki, enforceYetki, addProtectedRole, removeProtectedRole, addApprovedRole, removeApprovedRole } from '../lib/yetki.js';

export default {
  name: 'yetki-kontrol',
  aliases: [],
  description: 'Korumali rolleri, onayli rolleri ve rawy taramasi yonetir.',
  category: 'Yetki Kontrol',
  system: 'yetkikontrol',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'islem', type: 'string', required: true, description: 'liste|tara|uygula|koruma-ekle|koruma-cikar|onay-ekle|onay-cikar' },
    { name: 'rol', type: 'role', required: false, description: 'Hedef rol' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const islem = String(ctx.args.islem || '').toLowerCase();
    if (islem === 'koruma-ekle') {
      const rid = ctx.args.rol?.id ?? ctx.args.rol;
      if (!rid) return await ctx.reply(errorTemplate(t('yetki.target_need_title'), [t('yetki.target_need')]));
      await addProtectedRole(ctx.guild.id, rid);
      return await ctx.reply(success(t('yetki.protected_added_title'), [t('yetki.protected_added', { rol: `<@&${rid}>` })]));
    }
    if (islem === 'koruma-cikar') {
      const rid = ctx.args.rol?.id ?? ctx.args.rol;
      await removeProtectedRole(ctx.guild.id, rid);
      return await ctx.reply(success(t('yetki.protected_removed_title'), [t('yetki.protected_removed', { rol: `<@&${rid}>` })]));
    }
    if (islem === 'onay-ekle') {
      const rid = ctx.args.rol?.id ?? ctx.args.rol;
      await addApprovedRole(ctx.guild.id, rid);
      return await ctx.reply(success(t('yetki.approved_added_title'), [t('yetki.approved_added', { rol: `<@&${rid}>` })]));
    }
    if (islem === 'onay-cikar') {
      const rid = ctx.args.rol?.id ?? ctx.args.rol;
      await removeApprovedRole(ctx.guild.id, rid);
      return await ctx.reply(success(t('yetki.approved_removed_title'), [t('yetki.approved_removed', { rol: `<@&${rid}>` })]));
    }
    if (islem === 'tara') {
      const cfg = await (await import('../lib/yetki.js')).getConfig(ctx.guild.id);
      const rows = await scanYetki(ctx.guild, cfg);
      const lines = rows.map((r) => `<@${r.member.id}>: ${r.roles.map((x) => `<@&${x}>`).join(', ')}`).slice(0, 20);
      return await ctx.reply(listTemplate({ title: t('yetki.scan_title'), lines: lines.length ? lines : [t('yetki.scan_ok')] }));
    }
    if (islem === 'uygula') {
      const result = await enforceYetki(ctx.client, ctx.guild, ctx.user.id);
      return await ctx.reply(success(t('yetki.enforce_title'), [t('yetki.enforce_line', { kullanici: result.unauthorized, rol: result.removed })]));
    }
    const cfg = await (await import('../lib/yetki.js')).getConfig(ctx.guild.id);
    return await ctx.reply(listTemplate({
      title: t('yetki.list_title'),
      lines: [t('yetki.list_protected', { roller: (cfg.protectedRoles || []).map((r) => `<@&${r}>`).join(', ') || '-' }), t('yetki.list_approved', { roller: (cfg.approvedRoles || []).map((r) => `<@&${r}>`).join(', ') || '-' })],
    }));
  },
};
