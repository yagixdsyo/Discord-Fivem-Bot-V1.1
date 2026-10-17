/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { emitLog } from '../../logging/lib/emit.js';
import { setCfx } from '../lib/state.js';

const HOST_RE = /^[a-z0-9](?:[a-z0-9.-]{0,98}[a-z0-9])?(?::\d{2,5})?$/i;

export default {
  name: 'sunucu-ip',
  aliases: ['sunucuip'],
  description: 'FiveM sunucu IP adresini ayarlar (Hızlı Giriş linklerinde kullanılır).',
  category: 'FiveM',
  system: 'fivem_durum',
  cooldown: 10,
  permission: { discord: ['ManageGuild'] },
  args: [{ name: 'ip', type: 'string', required: true, description: 'örn. 123.45.67.89:30120' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const ip = String(ctx.args.ip ?? '').trim();
    if (!HOST_RE.test(ip)) {
      await ctx.reply(errorTemplate(t('fivem.ip.invalid_title'), [t('fivem.ip.invalid')]));
      return;
    }

    const saved = await setCfx(ctx.guild.id, { ip });
    if (!saved) {
      await ctx.reply(errorTemplate(t('fivem.ip.save_fail_title'), [t('fivem.ip.save_fail')]));
      return;
    }

    await emitLog(ctx.guild, 'log_cfx_wh', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [t('fivem.ip.log_set', { ip: `\`${ip}\`` })],
      accent: 'info',
    });

    await ctx.reply(
      card({
        emojiKey: 'FIVEM',
        title: t('fivem.ip.set_title'),
        lines: [t('fivem.ip.set_line', { ip: `\`${ip}\`` })],
        accent: 'success',
      }),
    );
  },
};
