/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { randomBytes } from 'node:crypto';
import { confirm as confirmTemplate, error as errorTemplate, success } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { runConfirm } from '../../moderation/lib/uiFlow.js';
import { getCfx, setCfx } from '../lib/state.js';

export default {
  name: 'cfx-anahtar-yenile',
  aliases: ['cfxanahtaryenile'],
  description: 'CFX webhook HMAC anahtarını yeniden üretir (eski anahtar geçersiz olur).',
  category: 'FiveM',
  system: 'fivem_durum',
  cooldown: 15,
  permission: { discord: ['ManageGuild'] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const cfx = await getCfx(ctx.guild.id);
    if (!cfx.code) {
      await ctx.reply(errorTemplate(t('fivem.cfx.not_configured_title'), [t('fivem.cfx.not_configured')]));
      return;
    }

    const ownerId = ctx.user.id;
    const payload = confirmTemplate({
      title: t('fivem.cfx.rotate_confirm_title'),
      description: [t('fivem.cfx.rotate_confirm_body')],
      confirmId: `cfxrotateonay:${ownerId}`,
      cancelId: `cfxrotateiptal:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });
    const confirmed = await runConfirm(ctx, {
      payload,
      ownerId,
      confirmId: `cfxrotateonay:${ownerId}`,
      cancelId: `cfxrotateiptal:${ownerId}`,
    });
    if (!confirmed) return;

    const secret = randomBytes(32).toString('hex');
    const saved = await setCfx(ctx.guild.id, { secret });
    if (!saved) {
      await ctx.reply(errorTemplate(t('fivem.cfx.save_fail_title'), [t('fivem.cfx.save_fail')]));
      return;
    }

    await emitLog(ctx.guild, 'log_cfx_wh', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [t('fivem.cfx.log_rotated')],
      accent: 'warn',
    });

    await ctx.followUp(
      success(
        t('fivem.cfx.rotated_title'),
        [t('fivem.cfx.secret_line'), `\`\`\`${secret}\`\`\``, t('fivem.cfx.rotate_note')],
        { ephemeral: true },
      ),
    );
  },
};
