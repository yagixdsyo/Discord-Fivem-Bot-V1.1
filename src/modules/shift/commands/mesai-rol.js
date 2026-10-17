/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { emitLog } from '../../logging/lib/emit.js';

function roleLabel(t, roleId) {
  return roleId ? `<@&${roleId}>` : t('shift.role_none');
}

async function roleCard(t, guild, lib) {
  const cfg = await lib.getShiftConfig(guild.id);
  return card({
    emojiKey: 'ROL',
    title: t('shift.role_card_title'),
    subtitle: t('shift.role_card_sub', { sunucu: guild.name }),
    lines: [
      t('shift.role_card_mesai', { rol: roleLabel(t, cfg.shiftRoleId) }),
      t('shift.role_card_ilk', { rol: roleLabel(t, cfg.firstShiftRoleId) }),
      t('shift.role_card_legal', { rol: roleLabel(t, cfg.legalRoleId) }),
      t('shift.role_card_hint'),
    ],
    accent: 'primary',
    footer: t('shift.role_card_footer'),
  });
}

export default {
  name: 'mesai-rol',
  aliases: ['mesairol'],
  description: 'Sesli mesai rollerini ayarlar: mesai rolü, ilk kayıt rolü ve legal izni (argümansız: gösterir).',
  category: 'Mesai',
  system: 'mesai',
  cooldown: 3,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'mesai', type: 'role', required: false, description: 'Mesai boyunca verilecek rol' },
    { name: 'ilk', type: 'role', required: false, description: 'İlk mesai girişinde verilecek rol (ilk kayıt)' },
    { name: 'legal', type: 'role', required: false, description: 'Legal izni rolü (ilk mesai girişinde verilir)' },
    { name: 'islem', type: 'rest', required: false, description: '"kaldir mesai|ilk|legal" ayarı temizler' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/shifts.js');
    const guild = ctx.guild;

    const mesai = ctx.args.mesai ?? null;
    const ilk = ctx.args.ilk ?? null;
    const legal = ctx.args.legal ?? null;
    const islem = String(ctx.args.islem ?? '').trim();

    if (!mesai && !ilk && !legal && !islem) {
      await ctx.reply(await roleCard(t, guild, lib));
      return;
    }

    const me = guild.members.me;
    const tooHigh = (role) => !me || me.roles.highest.position <= role.position;
    const patch = {};
    const changed = [];

    if (mesai) {
      if (tooHigh(mesai)) {
        await ctx.reply(errorTemplate(t('shift.role_too_high_title'), [t('shift.role_too_high')]));
        return;
      }
      patch.shiftRoleId = mesai.id;
      changed.push(t('shift.role_set_mesai', { rol: `<@&${mesai.id}>` }));
    }

    if (ilk) {
      if (tooHigh(ilk)) {
        await ctx.reply(errorTemplate(t('shift.role_too_high_title'), [t('shift.role_too_high')]));
        return;
      }
      patch.firstShiftRoleId = ilk.id;
      changed.push(t('shift.role_set_ilk', { rol: `<@&${ilk.id}>` }));
    }

    if (legal) {
      if (tooHigh(legal)) {
        await ctx.reply(errorTemplate(t('shift.role_too_high_title'), [t('shift.role_too_high')]));
        return;
      }
      patch.legalRoleId = legal.id;
      changed.push(t('shift.role_set_legal', { rol: `<@&${legal.id}>` }));
    }

    if (islem) {
      const which = islem.replace(/^kald[iı]r\s*/i, '').trim().toLocaleLowerCase('tr');
      if (which === 'mesai') {
        patch.shiftRoleId = null;
        changed.push(t('shift.role_removed_mesai'));
      } else if (which === 'ilk') {
        patch.firstShiftRoleId = null;
        changed.push(t('shift.role_removed_ilk'));
      } else if (which === 'legal') {
        patch.legalRoleId = null;
        changed.push(t('shift.role_removed_legal'));
      } else {
        await ctx.reply(errorTemplate(t('shift.role_usage_title'), [t('shift.role_usage')]));
        return;
      }
    }

    await lib.setShiftConfig(guild.id, patch);

    await emitLog(guild, 'log_mesai', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [t('shift.role_log', { degisim: changed.join(' · ') })],
      accent: 'info',
    }).catch(() => {});

    await ctx.reply(
      card({
        emojiKey: 'ROL',
        title: t('shift.role_saved_title'),
        lines: changed,
        accent: 'success',
      }),
    );
    await ctx.followUp(await roleCard(t, guild, lib)).catch(() => {});
  },
};
