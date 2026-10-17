/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';

export default {
  name: 'basvuru-rol',
  aliases: [],
  description: 'Basvuru turune otomatik verilecek rolu tanimlar.',
  category: 'Basvuru',
  system: 'basvuru',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'tur', type: 'string', required: true, description: 'yetkili|whitelist|legal_ekip|illegal_ekip' },
    { name: 'rol', type: 'role', required: true, description: 'Verilecek rol' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/applications.js');
    const tur = String(ctx.args.tur || '').toLowerCase();
    if (!lib.getApplicationTypes()[tur]) {
      await ctx.reply(errorTemplate(t('basvuru_rol.invalid_type_title'), [t('basvuru_rol.invalid_type')]));
      return;
    }
    const rol = ctx.args.rol;
    const roleId = rol?.id ?? rol;
    await lib.setApplicationAutoRole(ctx.guild.id, tur, roleId);
    await ctx.reply(success(t('basvuru_rol.saved_title'), [t('basvuru_rol.saved', { tur, rol: `<@&${roleId}>` })]));
  },
};
