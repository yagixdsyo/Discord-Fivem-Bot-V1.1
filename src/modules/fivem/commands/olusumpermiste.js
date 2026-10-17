/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { getChannelId } from '../lib/maps.js';
import { createPermRequest, searchOlusums } from '../lib/olusum.js';
import { olusumPermCardPayload } from '../lib/view.js';

export default {
  name: 'oluşum-perm-iste',
  aliases: ['olusum-perm-iste'],
  description: 'Oluşumunuz için yetkililerden perm/rol talebi açar.',
  category: 'FiveM',
  system: null,
  cooldown: 60,
  permission: { discord: [] },
  args: [
    { name: 'roladi', type: 'string', required: true, description: 'İstenen rol adı' },
    { name: 'aciklama', type: 'rest', required: false, description: 'Açıklama / gerekçe' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const active = await searchOlusums(ctx.guild.id, { active: true, limit: 200 });
    const own =
      active.find((doc) => doc.owner_id === ctx.user.id) ??
      active.find((doc) => ctx.member?.roles?.cache?.has(doc.role_id));

    if (!own) {
      await ctx.reply(errorTemplate(t('fivem.olusum.perm_not_owner_title'), [t('fivem.olusum.perm_not_owner')]));
      return;
    }

    const roleName = String(ctx.args.roladi ?? '').trim();
    if (!roleName) {
      await ctx.reply(errorTemplate(t('fivem.olusum.input_missing_title'), [t('fivem.olusum.input_missing')]));
      return;
    }
    const note = ctx.args.aciklama ? String(ctx.args.aciklama).trim() : null;

    const doc = await createPermRequest({
      guildId: ctx.guild.id,
      olusumId: own.olusum_id,
      name: own.name,
      userId: ctx.user.id,
      userTag: ctx.user.username ?? null,
      roleName,
      note,
    });

    const channelId = await getChannelId(ctx.guild.id, 'log_yetki_ver_al');
    let posted = false;
    if (channelId) {
      const channel = ctx.guild.channels.cache.get(channelId) ?? (await ctx.guild.channels.fetch(channelId).catch(() => null));
      if (channel && typeof channel.send === 'function') {
        posted = await channel
          .send(olusumPermCardPayload(t, { doc, ownerId: ctx.user.id }))
          .then(() => true)
          .catch(() => false);
      }
    }

    await emitLog(ctx.guild, 'log_yetki_ver_al', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [t('fivem.olusum.log_perm_request', { ad: `**${own.name}**`, rol: roleName, not: note ?? '-' })],
      accent: 'warn',
    });

    await ctx.reply(
      success(t('fivem.olusum.perm_request_title'), [
        t('fivem.olusum.perm_request_line', { ad: `**${own.name}**`, rol: `**${roleName}**` }),
        posted ? t('fivem.olusum.perm_request_posted') : t('fivem.olusum.perm_request_channel_missing'),
        `-# \`${doc.perm_id}\``,
      ]),
    );
  },
};
