/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { markSanctioned } from '../../guard/lib/sanction.js';
import { applyWhitelist } from '../lib/whitelist.js';
import { whitelistPayload } from '../lib/view.js';

function parseRoleIds(input) {
  const text = String(input ?? '');
  const ids = new Set();
  for (const match of text.matchAll(/<@&(\d{15,25})>/g)) ids.add(match[1]);
  for (const match of text.matchAll(/\b(\d{15,25})\b/g)) ids.add(match[1]);
  return [...ids];
}

export default {
  name: 'whver',
  aliases: [],
  description: 'Detaylı whitelist: isim şablonu, ek roller ve not ile birlikte onaylar.',
  category: 'FiveM',
  system: 'whitelist',
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Kullanıcı' },
    { name: 'icisim', type: 'string', required: true, description: 'IC isim' },
    { name: 'oocisim', type: 'string', required: false, description: 'OOC isim (nota yazılır)' },
    { name: 'ekroller', type: 'string', required: false, description: 'Ek roller (mention veya ID, virgülle)' },
    { name: 'not', type: 'rest', required: false, description: 'Not' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const arg = ctx.args.kullanici;
    const member = arg?.roles ? arg : await ctx.guild.members.fetch(arg?.user?.id ?? arg?.id ?? '').catch(() => null);
    if (!member) {
      await ctx.reply(errorTemplate(t('fivem.wh.member_missing_title'), [t('fivem.wh.member_missing')]));
      return;
    }

    const icisim = String(ctx.args.icisim ?? '').trim();
    if (!icisim) {
      await ctx.reply(errorTemplate(t('fivem.wh.name_required_title'), [t('fivem.wh.name_required')]));
      return;
    }
    const oocisim = ctx.args.oocisim ? String(ctx.args.oocisim).trim() : null;
    const not = ctx.args.not ? String(ctx.args.not).trim() : null;

    const result = await applyWhitelist(ctx.guild, { member, actorId: ctx.user.id, isim: icisim });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.wh.fail_title'), [t('fivem.wh.fail')]));
      return;
    }

    const addedRoles = [];
    const skippedRoles = [];
    const roleIds = parseRoleIds(ctx.args.ekroller);
    if (roleIds.length > 0) {
      const me = ctx.guild.members.me;
      for (const roleId of roleIds) {
        const role = ctx.guild.roles.cache.get(roleId) ?? (await ctx.guild.roles.fetch(roleId).catch(() => null));
        if (!role || !me || me.roles.highest.position <= role.position || role.managed) {
          skippedRoles.push(roleId);
          continue;
        }
        try {
          await markSanctioned({ guildId: ctx.guild.id, targetId: member.id, roleIds: [role.id] }).catch(() => {});
          await member.roles.add(role, `whver: ${ctx.user.id}`);
          addedRoles.push(role.id);
        } catch {
          skippedRoles.push(roleId);
        }
      }
    }

    await emitLog(ctx.guild, 'log_whitelist', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: member.id,
      targetTag: member.user.username,
      lines: [
        t('fivem.wh.log_given', { kullanici: `<@${member.id}>`, isim: `**${icisim}**` }),
        oocisim ? t('fivem.wh.log_ooc', { isim: oocisim }) : null,
        addedRoles.length ? t('fivem.wh.log_extra_roles', { roller: addedRoles.map((id) => `<@&${id}>`).join(', ') }) : null,
        skippedRoles.length ? t('fivem.wh.log_skipped_roles', { roller: skippedRoles.map((id) => `\`${id}\``).join(', ') }) : null,
        not ? t('fivem.wh.log_note', { not }) : null,
      ].filter(Boolean),
      accent: 'success',
    });

    await ctx.reply(whitelistPayload(t, { action: 'ver', userId: member.id, isim: icisim, actorId: ctx.user.id }));
  },
};
