/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { resolveTargetGuild } from '../lib/guildResolve.js';
import { auditAction } from '../lib/audit.js';
import { notifyGuildSystemChannel, notifyUserDm } from '../lib/ownerLog.js';
import { panel, success, warn } from '../../ui/templates/index.js';
import { footerLine } from '../../ui/v2.js';

async function sendToGuild(config, guild, card) {
  try {
    const owner = await guild.fetchOwner();
    if (await notifyUserDm(config, owner.id, card)) return 'dm';
  } catch {
    /* uye cekilemedi */
  }
  if (await notifyGuildSystemChannel(guild, card)) return 'kanal';
  return 'basarisiz';
}

export default {
  name: 'duyuru-gönder',
  aliases: ['duyuru-gonder'],
  description: 'Sunucu sahiplerine duyuru mesajı gönderir.',
  category: 'Duyuru',
  args: [
    { name: 'hedef', type: 'string', required: true, description: 'hepsi | sunucu ID/adı' },
    { name: 'mesaj', type: 'rest', required: true, description: 'Duyuru metni' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const message = String(ctx.args.mesaj ?? '').trim().slice(0, 2000);
    if (!message) {
      await ctx.reply(warn(t('owner.say.empty'), []));
      return;
    }

    const card = panel({
      emojiKey: 'DUYURU',
      title: t('owner.say.title'),
      lines: [message],
      footer: footerLine([t('owner.say.footer')]),
    });

    const raw = String(ctx.args.hedef ?? '').trim().toLocaleLowerCase('tr');
    let guilds = [];

    if (raw === 'hepsi') {
      guilds = [...ctx.client.guilds.cache.values()];
    } else {
      const guild = await resolveTargetGuild(ctx, ctx.args.hedef);
      if (!guild) return;
      guilds = [guild];
    }

    let sent = 0;
    let failed = 0;
    for (const guild of guilds) {
      const result = await sendToGuild(ctx.config, guild, card);
      if (result === 'basarisiz') failed += 1;
      else sent += 1;
    }

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'duyuru-gonder',
      target: raw,
      payload: { adet: guilds.length, gonderilen: sent, basarisiz: failed },
      t,
    });

    await ctx.reply(success(t('owner.say.done'), [t('owner.say.result', { gonderilen: sent, basarisiz: failed })]));
  },
};
