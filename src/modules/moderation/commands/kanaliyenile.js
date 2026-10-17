/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success as successTemplate } from '../../../ui/templates/index.js';
import { confirm as confirmTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { runConfirm } from '../lib/uiFlow.js';

const PURGE_MAX = 500;

export default {
  name: 'kanalı-yenile',
  aliases: ['kanaliyenile'],
  description: 'Kanalı yeniden oluşturur (isteğe bağlı mesajları temizler).',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 10,
  permission: { discord: ['ManageChannels'], node: 'moderation.kanal' },
  args: [
    { name: 'kanal', type: 'channel', required: false, description: 'Kanal (boşsa bu kanal)' },
    {
      name: 'secenek',
      type: 'choice',
      required: false,
      description: 'Mesajlar ne olsun?',
      choices: [
        { name: 'Temizle (mesajlar silinir)', value: 'temizle' },
        { name: 'Kopyala (mesajlara dokunma)', value: 'kopyala' },
      ],
    },
  ],

  async run(ctx) {
    const t = ctx.t;
    const channel = ctx.args.kanal ?? ctx.channel;
    const secenek = ctx.args.secenek ?? 'temizle';

    if (!channel?.isTextBased?.() || !channel.clone) {
      await ctx.reply(errorTemplate(t('moderation.renew.not_supported_title'), [t('moderation.renew.not_supported_body')]));
      return;
    }

    const ownerId = ctx.user.id;
    const preview = confirmTemplate({
      title: t('moderation.renew.confirm_title'),
      description: [
        t('moderation.renew.confirm_body', { kanal: `<#${channel.id}>` }),
        secenek === 'temizle' ? t('moderation.renew.confirm_clear') : t('moderation.renew.confirm_copy'),
      ],
      confirmId: `yenileonay:${ownerId}`,
      cancelId: `yenileiptal:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });

    const confirmed = await runConfirm(ctx, {
      payload: preview,
      ownerId,
      confirmId: `yenileonay:${ownerId}`,
      cancelId: `yenileiptal:${ownerId}`,
    });
    if (!confirmed) return;

    let clone;
    try {
      clone = await channel.clone({ reason: 'Kanal yenilendi' });
      await clone.setPosition(channel.rawPosition ?? channel.position).catch(() => {});
    } catch {
      await ctx.followUp(errorTemplate(t('moderation.renew.failed_title'), [t('moderation.renew.failed_body')]));
      return;
    }

    if (secenek === 'temizle') {
      let budget = PURGE_MAX;
      try {
        while (budget > 0) {
          const fetched = await channel.messages.fetch({ limit: 100 });
          const deletable = fetched.filter(
            (message) => !message.pinned && Date.now() - message.createdTimestamp < 14 * 86_400_000,
          );
          if (deletable.size === 0) break;
          await channel.bulkDelete(deletable, true).catch(() => {});
          budget -= 100;
          if (fetched.size < 100) break;
        }
      } catch {
        /* temizlik kismi kalsa da kanal yenilenir */
      }
    }

    await channel.delete('Kanal yenilendi').catch(() => {});

    await emitLog(ctx.guild, 'log_kanal_guncelle', {
      actor: ctx.user.id,
      actorTag: ctx.user.username ?? null,
      lines: [
        `Eski kanal: **#${channel.name ?? channel.id}**`,
        `Yeni kanal: <#${clone.id}>`,
        secenek === 'temizle' ? 'Mesajlar temizlendi.' : 'Mesajlara dokunulmadı.',
      ],
    }).catch(() => {});

    const resultCard = successTemplate(t('moderation.renew.done_title'), [
      t('moderation.renew.done_body', { kanal: `<#${clone.id}>` }),
    ]);

    if (channel.id === ctx.channel.id) {
      await clone.send(resultCard).catch(() => {});
    } else {
      await ctx.followUp(resultCard).catch(() => {});
    }
  },
};
