/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { createTranslator } from '../../../locales/index.js';
import { getSetting, setSetting } from '../../fivem/lib/state.js';

export default {
  name: 'rank-rol',
  aliases: ['rutbe-rol', 'rank-role'],
  description: 'Site rutbe kayitlarini Discord rolleriyle esler.',
  category: 'Bot',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'rutbe', type: 'string', required: true, description: 'Legal-site rutbe anahtari' },
    { name: 'rol', type: 'role', required: true, description: 'Eslenecek Discord rolu' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const { role } = ctx.args;
    const rutbe = String(ctx.args.rutbe).trim();
    if (!rutbe) {
      await ctx.reply(errorTemplate(t('site.mapping_invalid_title'), [t('site.mapping_invalid')]));
      return;
    }
    const settings = (await getSetting(ctx.guild.id, 'site.rankMappings')) ?? {};
    settings[rutbe] = role.id;
    await setSetting(ctx.guild.id, 'site.rankMappings', settings);
    await ctx.reply(success(t('site.mapping_saved_title'), [t('site.mapping_saved', { rutbe, rol: role.toString() })]));
  },
};
