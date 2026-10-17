/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { confirm as confirmTemplate, error as errorTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { buildTranscriptHtml, collectForDelete, uploadTranscript } from '../lib/transcript.js';
import { runConfirm } from '../lib/uiFlow.js';
import { silResultPayload } from '../lib/view.js';

export default {
  name: 'sil',
  aliases: ['temizle', 'purge'],
  description: 'Kanaldaki son mesajları siler ve transcript oluşturur.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  permission: { discord: ['ManageMessages'], node: 'moderation.mesaj' },
  args: [{ name: 'adet', type: 'integer', required: false, description: 'Silinecek mesaj sayısı (varsayılan 10, en fazla 100)' }],

  async run(ctx) {
    const t = ctx.t;
    const count = Math.min(Math.max(1, ctx.args.adet ?? 10), 100);
    if (!ctx.channel?.isTextBased?.()) {
      await ctx.reply(errorTemplate(t('moderation.clear.not_text_title'), [t('moderation.clear.not_text_body')]));
      return;
    }

    const ownerId = ctx.user.id;
    const preview = confirmTemplate({
      title: t('moderation.clear.confirm_title'),
      description: [
        t('moderation.clear.confirm_body', { adet: count, kanal: `<#${ctx.channel.id}>` }),
        t('moderation.clear.confirm_note'),
      ],
      confirmId: `silonay:${ownerId}`,
      cancelId: `siliptal:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });

    const confirmed = await runConfirm(ctx, {
      payload: preview,
      ownerId,
      confirmId: `silonay:${ownerId}`,
      cancelId: `siliptal:${ownerId}`,
    });
    if (!confirmed) return;

    let collected;
    try {
      collected = await collectForDelete(ctx.channel, count);
    } catch {
      await ctx.followUp(errorTemplate(t('moderation.clear.fetch_failed_title'), [t('moderation.clear.fetch_failed_body')]));
      return;
    }

    const { messages, deletable, skippedPinned, skippedOld } = collected;
    const html = buildTranscriptHtml({
      guildName: ctx.guild.name,
      channelName: ctx.channel.name ?? ctx.channel.id,
      messages,
    });
    const transcriptUrl = await uploadTranscript(html, `transcript-${ctx.channel.name ?? ctx.channel.id}`);

    await emitLog(ctx.guild, 'log_toplu_silme', {
      actor: ctx.user.id,
      actorTag: ctx.user.username ?? null,
      lines: [
        `Kanal: <#${ctx.channel.id}>`,
        `Getirilen: **${messages.length}** • Silinen: **${deletable.length}**`,
        skippedPinned > 0 ? `Sabit (korunan): **${skippedPinned}**` : null,
        skippedOld > 0 ? `14 günden eski: **${skippedOld}**` : null,
        transcriptUrl ? `Transcript: ${transcriptUrl}` : 'Transcript dosya olarak eklendi.',
      ].filter(Boolean),
      files: [new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `transcript-${Date.now()}.html` })],
    }).catch(() => {});

    let deleted = 0;
    if (deletable.length > 0) {
      try {
        const result = await ctx.channel.bulkDelete(deletable, true);
        deleted = result.size;
      } catch {
        deleted = 0;
      }
    }

    await ctx.followUp(
      silResultPayload(t, {
        deleted,
        skippedPinned,
        skippedOld,
        transcriptUrl,
        hasFile: true,
      }),
    );
  },
};
