/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card, error as errorTemplate } from '../../../ui/templates/index.js';
import { comparePermissionSets } from '../lib/permissions.js';

export default {
  name: 'rol-karsilastir',
  aliases: ['rolkarsilastir'],
  description: 'Iki rolu izin kumesi farklarina gore karsilastirir.',
  category: 'Izin Dedektifi',
  system: 'izin',
  cooldown: 10,
  permission: { discord: ['Administrator'] },
  args: [
    { name: 'rol1', type: 'role', required: true, description: 'Birinci rol' },
    { name: 'rol2', type: 'role', required: true, description: 'Ikinci rol' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const roleA = ctx.args.rol1;
    const roleB = ctx.args.rol2;
    if (!roleA || !roleB || roleA.id === roleB.id) {
      await ctx.reply(errorTemplate(t('izin.compare_invalid_title'), [t('izin.compare_invalid')]));
      return;
    }

    const { common, onlyA, onlyB } = comparePermissionSets(roleA, roleB);
    const lines = [
      t('izin.compare_roles', { rol1: `<@&${roleA.id}>`, rol2: `<@&${roleB.id}>` }),
      t('izin.compare_counts', { ortak: common.length, sadece1: onlyA.length, sadece2: onlyB.length }),
      t('izin.compare_common', { izinler: common.slice(0, 20).join(', ') || t('izin.compare_none') }),
      t('izin.compare_only1', { izinler: onlyA.slice(0, 20).join(', ') || t('izin.compare_none') }),
      t('izin.compare_only2', { izinler: onlyB.slice(0, 20).join(', ') || t('izin.compare_none') }),
    ];
    await ctx.reply(card({
      emojiKey: 'BELGE',
      title: t('izin.compare_title'),
      lines,
      footer: t('izin.compare_footer', { uye1: roleA.members.size, uye2: roleB.members.size }),
    }));
  },
};
