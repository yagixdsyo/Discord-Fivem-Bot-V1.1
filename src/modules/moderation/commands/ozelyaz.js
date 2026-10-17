/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from '../../../ui/templates/base.js';
import { button, gallery, row, thumbnail } from '../../../ui/v2.js';
import { colorToInt } from '../../../ui/colors.js';
import { error as errorTemplate, success as successTemplate, warn as warnTemplate } from '../../../ui/templates/index.js';
import { ensureMessage, waitForInteraction } from '../../setup/lib/interact.js';
import { disabledCard } from '../../../ui/templates/base.js';

const COLOR_CHOICES = [
  { name: 'Mavi', value: 'primary' },
  { name: 'Yeşil', value: 'success' },
  { name: 'Kırmızı', value: 'error' },
  { name: 'Sarı', value: 'warn' },
  { name: 'Mor', value: 'info' },
];

function buildCard(t, { baslik, aciklama, colorHex, resimUrl, kucukResimUrl, ownerId, preview }) {
  const buttons = [];
  if (preview) {
    buttons.push(
      row([
        button({ id: `yazgonder:${ownerId}`, label: t('moderation.write.send'), emojiKey: 'OK_SAG', style: 'success' }),
        button({ id: `yaziptal:${ownerId}`, label: t('common.cancel'), emojiKey: 'RED', style: 'secondary' }),
      ]),
    );
  }

  return card({
    emojiKey: 'DUYURU',
    title: baslik,
    sections: [kucukResimUrl ? { text: aciklama, accessory: thumbnail(kucukResimUrl) } : aciklama],
    accentColor: colorToInt(colorHex),
    buttons,
    fileComponents: resimUrl ? [gallery([resimUrl])] : [],
  });
}

export default {
  name: 'özel-yaz',
  aliases: ['ozelyaz'],
  description: 'Küçük görselli özel duyuru kartı gönderir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  permission: { discord: ['ManageMessages'], node: 'moderation.mesaj' },
  args: [
    { name: 'kanal', type: 'channel', required: true, description: 'Gönderilecek kanal' },
    { name: 'baslik', type: 'string', required: true, description: 'Başlık (tırnaklı tek parça)' },
    { name: 'aciklama', type: 'rest', required: true, description: 'Açıklama metni' },
    { name: 'renk', type: 'choice', required: false, description: 'Vurgu rengi', choices: COLOR_CHOICES },
    { name: 'resim', type: 'attachment', required: false, description: 'Büyük görsel' },
    { name: 'kucuk-resim', type: 'attachment', required: false, description: 'Küçük görsel (thumbnail)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const channel = ctx.args.kanal;
    if (!channel?.isTextBased?.()) {
      await ctx.reply(errorTemplate(t('moderation.write.not_text_title'), [t('moderation.write.not_text_body')]));
      return;
    }

    const baslik = String(ctx.args.baslik ?? '').slice(0, 180);
    const aciklama = String(ctx.args.aciklama ?? '').slice(0, 3800);
    const colorHex = ctx.colors[ctx.args.renk ?? 'primary'] ?? ctx.colors.primary;
    const resimUrl = ctx.args.resim?.url ?? null;
    const kucukResimUrl = ctx.args['kucuk-resim']?.url ?? null;
    const ownerId = ctx.user.id;

    let lastPayload = buildCard(t, { baslik, aciklama, colorHex, resimUrl, kucukResimUrl, ownerId, preview: true });
    const message = await ensureMessage(ctx, await ctx.reply(lastPayload, { fetchReply: true }));
    if (!message || typeof message.awaitMessageComponent !== 'function') return;

    for (;;) {
      const interaction = await waitForInteraction(message, ownerId);
      if (!interaction) {
        await message.edit(disabledCard(lastPayload)).catch(() => {});
        return;
      }

      if (interaction.customId === `yaziptal:${ownerId}`) {
        await interaction
          .update(warnTemplate(t('moderation.write.cancelled_title'), [t('moderation.write.cancelled_body')]))
          .catch(() => {});
        return;
      }

      if (interaction.customId === `yazgonder:${ownerId}`) {
        const finalCard = buildCard(t, { baslik, aciklama, colorHex, resimUrl, kucukResimUrl, ownerId, preview: false });
        const sent = await channel.send(finalCard).catch(() => null);
        if (!sent) {
          await interaction.deferUpdate().catch(() => {});
          await ctx.followUp(errorTemplate(t('moderation.write.failed_title'), [t('moderation.write.failed_body')]));
          return;
        }
        await interaction
          .update(successTemplate(t('moderation.write.done_title'), [t('moderation.write.done_body', { kanal: `<#${channel.id}>` })]))
          .catch(() => {});
        return;
      }

      await interaction.deferUpdate().catch(() => {});
    }
  },
};
