/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { randomBytes } from 'node:crypto';
import { error as errorTemplate, success, warn as warnTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { cfxJoinLink, extractCfxCode, fetchServerInfo } from '../lib/cfx.js';
import { getCfx, setCfx } from '../lib/state.js';

export default {
  name: 'cfx-ayarla',
  aliases: ['cfxayarla'],
  description: 'CFX kodu/join linkini ayarlar; webhook anahtarını üretir.',
  category: 'FiveM',
  system: 'fivem_durum',
  cooldown: 10,
  permission: { discord: ['ManageGuild'] },
  args: [{ name: 'kod', type: 'string', required: true, description: 'cfx.re/join/<kod> veya kod' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const code = extractCfxCode(ctx.args.kod);
    if (!code) {
      await ctx.reply(errorTemplate(t('fivem.cfx.invalid_title'), [t('fivem.cfx.invalid')]));
      return;
    }

    const info = await fetchServerInfo(code, { fresh: true });

    const existing = await getCfx(ctx.guild.id);
    const secret = existing.secret ?? randomBytes(32).toString('hex');
    const saved = await setCfx(ctx.guild.id, { code, secret, joinedAt: new Date().toISOString() });
    if (!saved) {
      await ctx.reply(errorTemplate(t('fivem.cfx.save_fail_title'), [t('fivem.cfx.save_fail')]));
      return;
    }

    await emitLog(ctx.guild, 'log_cfx_wh', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [t('fivem.cfx.log_set', { kod: `\`${code}\``, link: cfxJoinLink(code) })],
      accent: 'info',
    });

    await ctx.reply(
      info.ok
        ? success(t('fivem.cfx.set_title'), [
            t('fivem.cfx.set_line', { kod: `\`${code}\`` }),
            t('fivem.cfx.set_info', { sunucu: `**${info.name ?? '-'}**`, oyuncu: `**${info.players}** / ${info.maxPlayers}` }),
            t('fivem.cfx.set_link', { link: cfxJoinLink(code) }),
          ])
        : warnTemplate(t('fivem.cfx.set_title'), [
            t('fivem.cfx.set_line', { kod: `\`${code}\`` }),
            t('fivem.cfx.offline_note'),
          ]),
    );

    await ctx.followUp(
      success(
        t('fivem.cfx.secret_title'),
        [
          t('fivem.cfx.secret_line'),
          `\`\`\`${secret}\`\`\``,
          t('fivem.cfx.secret_usage', { guild: ctx.guild.id, port: process.env.FIVEM_WH_PORT ?? '3001' }),
          t('fivem.cfx.secret_events'),
          t('fivem.cfx.secret_hmac'),
        ],
        { ephemeral: true },
      ),
    );
  },
};
