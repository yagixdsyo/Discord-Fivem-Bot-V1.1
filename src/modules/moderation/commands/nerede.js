/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { neredePayload } from '../lib/view.js';

export default {
  name: 'nerede',
  aliases: ['nerde', 'kişi-nerde', 'kisi-nerde'],
  description: 'Bir üyenin hangi ses kanalında olduğunu gösterir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  args: [{ name: 'kullanici', type: 'member', required: false, description: 'Üye (boşsa kendin)' }],

  async run(ctx) {
    const t = ctx.t;
    const member = ctx.args.kullanici ?? ctx.member;
    const user = member?.user ?? ctx.user;

    const voiceChannel = member?.voice?.channel ?? null;
    const voiceText = voiceChannel
      ? t('moderation.where.in_voice', {
          kanal: `<#${voiceChannel.id}>`,
          kisiler: voiceChannel.members?.size ?? 0,
        })
      : null;

    // Mikrofon / kulaklık / yayın durumu
    let micText = null;
    let deafText = null;
    let streamText = null;
    const voice = member?.voice;
    if (voiceChannel && voice) {
      micText = voice.serverMute
        ? t('moderation.where.mic_server')
        : voice.selfMute
          ? t('moderation.where.mic_off')
          : t('moderation.where.mic_on');
      deafText = voice.serverDeaf
        ? t('moderation.where.deaf_server')
        : voice.selfDeaf
          ? t('moderation.where.deaf_off')
          : t('moderation.where.deaf_on');
      if (voice.streaming) streamText = t('moderation.where.streaming');
    }

    // Oyunda mı: bot-native CFX presence kaydı (site bağımsız)
    const presence = await import('../../fivem/lib/presence.js');
    let gameText;
    if (presence.hasPresenceData(ctx.guild.id)) {
      const found = presence.findOnlineByDiscordId(ctx.guild.id, user.id);
      gameText = found
        ? t('moderation.where.game_online', { isim: found.name ?? '-', id: found.id ?? '-' })
        : t('moderation.where.game_offline');
    } else {
      gameText = t('moderation.where.game_unknown');
    }

    const presenceStatus = member?.presence?.status ?? 'offline';
    const statusText = t(`moderation.where.status.${presenceStatus}`) ?? presenceStatus;

    await ctx.reply(
      neredePayload(t, {
        userTag: user.username,
        userId: user.id,
        voiceText,
        statusText,
        micText,
        deafText,
        streamText,
        gameText,
      }),
    );
  },
};
