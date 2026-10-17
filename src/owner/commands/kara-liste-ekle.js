/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { resolveTargetGuild } from '../lib/guildResolve.js';
import { parseBlacklistInput } from '../lib/parse.js';
import { addBlacklist } from '../lib/state.js';
import { auditAction } from '../lib/audit.js';
import { ownerConfirm } from '../lib/confirm.js';
import { notifyUserDm } from '../lib/ownerLog.js';
import { error as errorTemplate, success, warn } from '../../ui/templates/index.js';

export default {
  name: 'kara-liste-ekle',
  description: 'Bir sunucuyu kara listeye alır.',
  category: 'Sunucu',
  args: [
    { name: 'sunucu', type: 'string', required: true, description: 'Sunucu ID veya adı' },
    { name: 'sebep', type: 'rest', required: false, description: 'Sebep (--kal: sunucudan ayrılma)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const guild = await resolveTargetGuild(ctx, ctx.args.sunucu);
    if (!guild) return;

    const { keepGuild, reason } = parseBlacklistInput(ctx.args.sebep);

    const approved = await ownerConfirm(ctx, {
      title: t('owner.confirm_blacklist_title'),
      description: [
        t('owner.confirm_blacklist_body', { sunucu: guild.name }),
        keepGuild ? t('owner.blacklist.keep_note') : t('owner.blacklist.leave_note'),
      ],
      danger: true,
    });
    if (!approved) return;

    const result = await addBlacklist({
      guildId: guild.id,
      reason,
      addedBy: ctx.user.id,
      notify: true,
    });
    if (!result.ok) {
      await ctx.reply(warn(t('owner.db_unavailable'), []));
      return;
    }

    // Sunucu sahibine DM
    const dmCard = errorTemplate(t('owner.blacklist_dm_title'), [
      t('owner.blacklist_dm_body', { sunucu: guild.name }),
    ]);
    await notifyUserDm(ctx.config, guild.ownerId, dmCard);

    if (!keepGuild) await guild.leave().catch(() => {});

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'kara-liste-ekle',
      target: guild.id,
      guildId: guild.id,
      payload: { sebep: reason, kaldi: keepGuild },
      t,
    });

    const lines = [keepGuild ? t('owner.blacklist.kept') : t('owner.blacklist.left')];
    if (reason) lines.push(t('owner.reason_line', { sebep: reason }));
    await ctx.reply(success(t('owner.blacklist.done', { sunucu: guild.name }), lines));
  },
};
