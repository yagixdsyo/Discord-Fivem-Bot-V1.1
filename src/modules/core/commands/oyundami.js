/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';

export default {
  name: 'oyunda-mi',
  aliases: ['oyundami'],
  description: "Belirtilen kullanicinin oyunda olup olmadigini kontrol eder.",
  category: 'Bot',
  system: null,
  cooldown: 5,
  permission: { discord: [] },
  args: [{ name: 'kullanici', type: 'user', required: true, description: 'Kontrol edilecek kullanici' }],

  async run(ctx) {
    const t = ctx.t;
    const arg = ctx.args.kullanici;
    const target = arg?.user ?? arg;
    const presence = await import('../../fivem/lib/presence.js');

    // 1) Bot-native: CFX webhook kayitlari
    if (presence.hasPresenceData(ctx.guild.id)) {
      const found = presence.findOnlineByDiscordId(ctx.guild.id, target.id);
      if (found) {
        await ctx.reply(
          card({
            emojiKey: 'DURUM_AKTIF',
            title: t('fivem.presence.online_title'),
            lines: [
              t('fivem.presence.online_line', {
                kullanici: `<@${target.id}>`,
                isim: found.name ?? '-',
                id: found.id ?? '-',
              }),
            ],
            accent: 'success',
          }),
        );
        return;
      }
      await ctx.reply(
        card({
          emojiKey: 'BILGI',
          title: t('fivem.presence.offline_title'),
          lines: [
            t('fivem.presence.offline_line', {
              kullanici: `<@${target.id}>`,
              adet: presence.onlineCount(ctx.guild.id),
            }),
          ],
          accent: 'info',
        }),
      );
      return;
    }

    // 2) Yedek: site presence API (yalnizca yapilandirilmissa)
    const { createSiteClient } = await import('../../../web/siteClient.js');
    const client = await createSiteClient(process.env);
    if (!client.isConfigured()) {
      await ctx.reply(errorTemplate(t('fivem.presence.no_data_title'), [t('fivem.presence.no_data')]));
      return;
    }
    await ctx.deferReply({ ephemeral: true });
    try {
      const result = await client.queryPresence({ discordId: target.id });
      const status = String(result?.status ?? result?.state ?? 'bilinmiyor');
      const server = result?.server ?? 'bilinmiyor';
      const inGame = status.toLowerCase().includes('online') || status.toLowerCase().includes('oyun');
      await ctx.editReply(
        card({
          emojiKey: inGame ? 'DURUM_AKTIF' : 'BILGI',
          title: t('site.presence_title'),
          lines: [
            t('site.presence_line', {
              kullanici: `<@${target.id}>`,
              durum: status,
              sunucu: server,
              sonuc: inGame ? t('site.presence_yes') : t('site.presence_no'),
            }),
          ],
          accent: inGame ? 'success' : 'info',
        }),
      );
    } catch (error) {
      await ctx.editReply(
        errorTemplate(t('site.api_error_title'), [t('site.api_error', { hata: error?.message ?? String(error) })]),
      );
    }
  },
};
