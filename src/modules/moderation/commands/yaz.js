/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success as successTemplate, warn as warnTemplate } from '../../../ui/templates/index.js';
import { disabledCard } from '../../../ui/templates/base.js';
import { card } from '../../../ui/templates/base.js';
import { button, gallery, row } from '../../../ui/v2.js';
import { colorToInt } from '../../../ui/colors.js';
import { ensureMessage, waitForInteraction } from '../../setup/lib/interact.js';
import { yazPreviewPayload } from '../lib/view.js';

const COLOR_CHOICES = [
  { name: 'Mavi', value: 'primary' },
  { name: 'Yeşil', value: 'success' },
  { name: 'Kırmızı', value: 'error' },
  { name: 'Sarı', value: 'warn' },
  { name: 'Mor', value: 'info' },
];

export default {
  name: 'yaz',
  aliases: ['duyuru'],
  description: 'Belirtilen kanala V2 duyuru kartı gönderir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  permission: { discord: ['ManageMessages'], node: 'moderation.mesaj' },
  args: [
    { name: 'kanal', type: 'channel', required: true, description: 'Gönderilecek kanal' },
    { name: 'baslik', type: 'string', required: true, description: 'Başlık (tırnaklı tek parça)' },
    { name: 'aciklama', type: 'rest', required: true, description: 'Açıklama metni' },
    { name: 'renk', type: 'choice', required: false, description: 'Vurgu rengi', choices: COLOR_CHOICES },
    { name: 'resim', type: 'attachment', required: false, description: 'Büyük görsel (ek veya url)' },
    { name: 'buton-yazi', type: 'string', required: false, description: 'Link butonu yazısı' },
    { name: 'buton-link', type: 'string', required: false, description: 'Link butonu adresi (https://...)' },
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
    const renkKey = ctx.args.renk ?? 'primary';
    const colorHex = ctx.colors[renkKey] ?? ctx.colors.primary;
    const resim = ctx.args.resim ?? null;
    const butonYazi = ctx.args['buton-yazi'] ?? null;
    const butonLink = ctx.args['buton-link'] ?? null;

    const validLink = butonLink && /^https?:\/\//i.test(butonLink) ? butonLink : null;
    if (butonYazi && !validLink) {
      await ctx.reply(warnTemplate(t('moderation.write.bad_link_title'), [t('moderation.write.bad_link_body')]));
      return;
    }

    const ownerId = ctx.user.id;
    let lastPayload = yazPreviewPayload(t, {
      title: baslik,
      description: aciklama,
      colorHex,
      imageUrl: resim?.url ?? null,
      buttonLabel: butonYazi,
      buttonUrl: validLink,
      ownerId,
    });

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
        const finalCard = card({
          emojiKey: 'DUYURU',
          title: baslik,
          lines: [aciklama],
          accentColor: colorToInt(colorHex),
          buttons: validLink ? [row([button({ label: butonYazi, url: validLink, style: 'link' })])] : [],
          fileComponents: resim?.url ? [gallery([resim.url])] : [],
        });

        let sent = null;
        try {
          sent = await channel.send(finalCard);
        } catch {
          sent = null;
        }

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
