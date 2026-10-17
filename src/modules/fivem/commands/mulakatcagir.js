/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { button } from '../../../ui/v2.js';
import { emitLog } from '../../logging/lib/emit.js';
import { getChannelId } from '../lib/maps.js';
import { inviteToInterview } from '../lib/interviews.js';
import { interviewCardPayload } from '../lib/view.js';

export default {
  name: 'mülakat-çağır',
  aliases: ['mulakat-cagir'],
  description: 'Bir oyuncuyu mülakata çağırır: DM + yetkili kanalına karar kartı.',
  category: 'FiveM',
  system: 'mulakat',
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [{ name: 'kullanici', type: 'user', required: true, description: 'Mülakata çağrılacak kullanıcı' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const arg = ctx.args.kullanici;
    const user = arg?.user ?? arg;
    if (!user || user.bot) {
      await ctx.reply(errorTemplate(t('fivem.mulakat.user_invalid_title'), [t('fivem.mulakat.user_invalid')]));
      return;
    }

    const doc = await inviteToInterview({
      guildId: ctx.guild.id,
      userId: user.id,
      userTag: user.username ?? null,
      invitedBy: ctx.user.id,
    });

    const waitChannelId = await getChannelId(ctx.guild.id, 'mulakat_bekleme');
    const dmPayload = card({
      emojiKey: 'MULAKAT',
      title: t('fivem.mulakat.dm_title', { sunucu: ctx.guild.name }),
      lines: [
        t('fivem.mulakat.dm_line'),
        waitChannelId ? t('fivem.mulakat.dm_wait', { kanal: `**${ctx.guild.name}** > mülakat-bekleme` }) : null,
        t('fivem.mulakat.dm_footer'),
      ].filter(Boolean),
      accent: 'info',
      buttons: [
        [
          button({
            id: `mulakatdm:basla:${ctx.guild.id}:${doc.interview_id}`,
            label: t('fivem.mulakat.dm_start'),
            emojiKey: 'MULAKAT',
            style: 'primary',
          }),
        ],
      ],
    });
    const dmOk = await user.send(dmPayload).then(() => true).catch(() => false);

    const logChannelId = await getChannelId(ctx.guild.id, 'log_mulakat');
    let posted = false;
    if (logChannelId) {
      const channel = ctx.guild.channels.cache.get(logChannelId) ?? (await ctx.guild.channels.fetch(logChannelId).catch(() => null));
      if (channel && typeof channel.send === 'function') {
        posted = await channel
          .send(interviewCardPayload(t, { doc, ownerId: ctx.user.id }))
          .then(() => true)
          .catch(() => false);
      }
    }

    await emitLog(ctx.guild, 'log_mulakat', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: user.id,
      targetTag: user.username,
      lines: [
        t('fivem.mulakat.log_invited', { kullanici: `<@${user.id}>` }),
        dmOk ? t('fivem.mulakat.log_dm_ok') : t('fivem.mulakat.log_dm_fail'),
      ],
      accent: 'info',
    });

    await ctx.reply(
      success(t('fivem.mulakat.invited_title'), [
        t('fivem.mulakat.invited_line', { kullanici: `<@${user.id}>`, kod: `\`${doc.interview_id}\`` }),
        posted ? t('fivem.mulakat.log_posted') : t('fivem.mulakat.log_channel_missing'),
        dmOk ? t('fivem.mulakat.log_dm_ok') : t('fivem.mulakat.log_dm_fail'),
      ]),
    );
  },
};
