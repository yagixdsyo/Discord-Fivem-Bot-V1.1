/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success as successTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { reasonText } from '../lib/punishFlow.js';

export default {
  name: 'kilitle',
  aliases: ['kilit'],
  description: 'Kanalı herkese kapatır (@everyone yazamaz).',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  permission: { discord: ['ManageChannels'], node: 'moderation.kanal' },
  args: [
    { name: 'kanal', type: 'channel', required: false, description: 'Kanal (boşsa bu kanal)' },
    { name: 'sebep', type: 'rest', required: false, description: 'Sebep' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const channel = ctx.args.kanal ?? ctx.channel;
    if (!channel?.isTextBased?.() || channel.isThread?.()) {
      await ctx.reply(errorTemplate(t('moderation.lock.not_text_title'), [t('moderation.lock.not_text_body')]));
      return;
    }

    const reason = reasonText(ctx);
    try {
      await channel.permissionOverwrites.edit(
        ctx.guild.roles.everyone,
        { SendMessages: false },
        { reason: reason ?? 'Kanal kilitlendi' },
      );
    } catch {
      await ctx.reply(errorTemplate(t('moderation.lock.failed_title'), [t('moderation.lock.failed_body')]));
      return;
    }

    await emitLog(ctx.guild, 'log_izin', {
      actor: ctx.user.id,
      actorTag: ctx.user.username ?? null,
      reason,
      lines: [`Kanal: <#${channel.id}>`, 'İşlem: **kilitlendi** (@everyone yazamaz)', reason ? `Sebep: ${reason}` : null].filter(Boolean),
      accent: 'warn',
    }).catch(() => {});

    await ctx.reply(
      successTemplate(t('moderation.lock.title'), [
        t('moderation.lock.body', { kanal: `<#${channel.id}>` }),
        reason ? t('moderation.result.reason', { sebep: reason }) : null,
      ].filter(Boolean)),
    );
  },
};
