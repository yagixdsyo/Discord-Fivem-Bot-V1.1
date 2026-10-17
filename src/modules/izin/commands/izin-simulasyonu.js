/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card, error as errorTemplate } from '../../../ui/templates/index.js';
import { DANGEROUS_BITS, computeEffectivePermissions } from '../lib/permissions.js';

export default {
  name: 'izin-simulasyonu',
  aliases: ['izinsimulasyonu'],
  description: 'Bir uyenin belirtilen kanaldaki etkin izinlerini adim adim hesaplar.',
  category: 'Izin Dedektifi',
  system: 'izin',
  cooldown: 10,
  permission: { discord: ['Administrator'] },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Test edilecek uye' },
    { name: 'kanal', type: 'channel', required: true, description: 'Test edilecek kanal' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const user = ctx.args.kullanici;
    const channel = ctx.args.kanal;
    if (!user || !channel) {
      await ctx.reply(errorTemplate(t('izin.sim_invalid_title'), [t('izin.sim_invalid')]));
      return;
    }
    const member = await ctx.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await ctx.reply(errorTemplate(t('izin.sim_member_title'), [t('izin.sim_member')]));
      return;
    }

    const { permissions, steps, admin } = computeEffectivePermissions(member, channel);
    const discordPerms = channel.permissionsFor(member);
    const matches = Boolean(discordPerms && discordPerms.bitfield === permissions.bitfield);

    const overwriteSteps = steps.filter((step) => step.kind === 'overwrite').slice(-5);
    const granted = permissions.toArray();
    const riskyGranted = DANGEROUS_BITS.filter(([flag]) => permissions.has(flag)).map(([flag]) => flag);

    const lines = [
      t('izin.sim_target', { kullanici: `<@${member.id}>`, kanal: `<#${channel.id}>` }),
      t('izin.sim_step_count', { adet: steps.length, rol: member.roles.cache.size }),
      ...overwriteSteps.map((step) => t('izin.sim_step_line', {
        kaynak: step.source,
        allow: (step.allow ?? []).length,
        deny: (step.deny ?? []).length,
      })),
      t('izin.sim_granted', { adet: granted.length }),
      t('izin.sim_risky', { izinler: riskyGranted.join(', ') || t('izin.compare_none') }),
      matches ? t('izin.sim_verified') : t('izin.sim_mismatch'),
    ];
    if (admin) lines.push(t('izin.sim_admin'));

    await ctx.reply(card({
      emojiKey: 'BELGE',
      title: t('izin.sim_title'),
      lines,
      accent: admin || riskyGranted.length > 0 ? 'warn' : 'info',
    }));
  },
};
