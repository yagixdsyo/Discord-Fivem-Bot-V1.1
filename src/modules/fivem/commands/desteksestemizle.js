/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { confirm as confirmTemplate, error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { emitLog } from '../../logging/lib/emit.js';
import { runConfirm } from '../../moderation/lib/uiFlow.js';
import { getRoleId } from '../lib/maps.js';

export default {
  name: 'destek-ses-temizle',
  aliases: ['desteksestemizle'],
  description: 'Destek permine sahip tüm üyelerden destek rolünü alır (onaylı).',
  category: 'FiveM',
  system: 'destek_bekleme',
  cooldown: 30,
  permission: { discord: ['ManageRoles'] },
  args: [{ name: 'rol', type: 'role', required: false, description: 'Farklı rol (varsayılan: destek rolü)' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const roleId = ctx.args.rol?.id ?? (await getRoleId(ctx.guild.id, 'destek'));
    if (!roleId) {
      await ctx.reply(errorTemplate(t('fivem.destek.role_missing_title'), [t('fivem.destek.role_missing')]));
      return;
    }

    const role = ctx.guild.roles.cache.get(roleId) ?? (await ctx.guild.roles.fetch(roleId).catch(() => null));
    if (!role) {
      await ctx.reply(errorTemplate(t('fivem.destek.role_missing_title'), [t('fivem.destek.role_missing')]));
      return;
    }

    const targets = [...role.members.values()].filter((member) => !member.user.bot);
    if (targets.length === 0) {
      await ctx.reply(errorTemplate(t('fivem.destek.clean_none_title'), [t('fivem.destek.clean_none')]));
      return;
    }

    const ownerId = ctx.user.id;
    const payload = confirmTemplate({
      title: t('fivem.destek.clean_confirm_title'),
      description: [
        t('fivem.destek.clean_confirm_body', { adet: `**${targets.length}**`, rol: `<@&${role.id}>` }),
        t('fivem.destek.clean_confirm_note'),
      ],
      confirmId: `destektenizleonay:${ownerId}`,
      cancelId: `destektenizleiptal:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });
    const confirmed = await runConfirm(ctx, {
      payload,
      ownerId,
      confirmId: `destektenizleonay:${ownerId}`,
      cancelId: `destektenizleiptal:${ownerId}`,
    });
    if (!confirmed) return;

    let removed = 0;
    const failed = [];
    for (const member of targets) {
      try {
        await member.roles.remove(role, `Destek ses temizligi: ${ctx.user.id}`);
        removed += 1;
      } catch {
        failed.push(member.id);
      }
    }

    await emitLog(ctx.guild, 'log_destek_bekleme', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [t('fivem.destek.clean_log', { rol: `<@&${role.id}>`, adet: `**${removed}**`, hatali: `**${failed.length}**` })],
      accent: 'warn',
    });

    await ctx.followUp(
      card({
        emojiKey: 'DESTEK',
        title: t('fivem.destek.clean_done_title'),
        lines: [t('fivem.destek.clean_done', { adet: `**${removed}**`, hatali: `**${failed.length}**` })],
        accent: 'warn',
      }),
    );
  },
};
