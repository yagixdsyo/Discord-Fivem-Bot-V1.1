/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success as successTemplate } from '../../../ui/templates/index.js';
import { getWelcomeConfig, setWelcomeConfig } from '../lib/welcome.js';
import { otorolPayload } from '../lib/view.js';

export default {
  name: 'otorol-değiştir',
  aliases: ['otoroldegistir', 'otorol', 'hosgeldin-ayar'],
  description: 'Otorol ve hoş geldin sistemini ayarlar (argümansız: gösterir).',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'rol', type: 'role', required: false, description: 'Yeni üyelere verilecek otorol' },
    { name: 'kanal', type: 'channel', required: false, description: 'Hoş geldin mesajı kanalı' },
    { name: 'dm', type: 'boolean', required: false, description: 'DM ile hoş geldin (evet/hayır)' },
    { name: 'mesaj', type: 'rest', required: false, description: 'Hoş geldin mesajı ("kapat" = otorolü kapat; veda için vedakanal:#kanal / vedamesaj:metin / vedakapat)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const guildId = ctx.guild.id;

    const rol = ctx.args.rol ?? null;
    const kanal = ctx.args.kanal ?? null;
    const dm = ctx.args.dm;
    const mesaj = ctx.args.mesaj;

    const hasChange = Boolean(rol || kanal || dm !== undefined || mesaj !== undefined);
    if (!hasChange) {
      const cfg = await getWelcomeConfig(guildId);
      await ctx.reply(otorolPayload(t, { cfg, guild: ctx.guild }));
      return;
    }

    const patch = {};
    const changed = [];

    if (rol) {
      const me = ctx.guild.members.me;
      if (!me || me.roles.highest.position <= rol.position) {
        await ctx.reply(
          errorTemplate(t('moderation.autorole.role_too_high_title'), [t('moderation.autorole.role_too_high_body')]),
        );
        return;
      }
      patch.autoroleId = rol.id;
      changed.push(t('moderation.autorole.changed_role', { rol: `<@&${rol.id}>` }));
    }

    if (kanal) {
      if (!kanal.isTextBased?.()) {
        await ctx.reply(errorTemplate(t('moderation.autorole.bad_channel_title'), [t('moderation.autorole.bad_channel_body')]));
        return;
      }
      patch.channelId = kanal.id;
      changed.push(t('moderation.autorole.changed_channel', { kanal: `<#${kanal.id}>` }));
    }

    if (dm !== undefined) {
      patch.dm = Boolean(dm);
      changed.push(t('moderation.autorole.changed_dm', { durum: dm ? t('common.yes') : t('common.no') }));
    }

    if (mesaj !== undefined) {
      // Veda (gule gule) ayarlari ayni metin uzerinden geriye uyumlu sozdizimi ile:
      //   vedakanal:#kanal  |  vedakapat  |  vedamesaj:metin
      let text = String(mesaj).trim();

      const byeChannelMatch = text.match(/vedakanal:\s*(?:<#(\d+)>|(\d+))/i);
      if (byeChannelMatch) {
        const channelId = byeChannelMatch[1] ?? byeChannelMatch[2];
        const ch = ctx.guild.channels.cache.get(channelId);
        if (!ch || !ch.isTextBased?.()) {
          await ctx.reply(errorTemplate(t('moderation.autorole.bad_channel_title'), [t('moderation.autorole.bad_channel_body')]));
          return;
        }
        patch.byeChannelId = channelId;
        changed.push(t('moderation.autorole.changed_bye_channel', { kanal: `<#${channelId}>` }));
        text = text.replace(byeChannelMatch[0], '').trim();
      }

      if (/vedakapat/i.test(text)) {
        patch.byeChannelId = null;
        changed.push(t('moderation.autorole.changed_bye_off'));
        text = text.replace(/vedakapat/i, '').trim();
      }

      const byeMsgMatch = text.match(/vedamesaj:\s*([\s\S]+)/i);
      if (byeMsgMatch) {
        const byeMessage = byeMsgMatch[1].trim();
        if (byeMessage.length > 0) {
          patch.byeMessage = byeMessage.slice(0, 400);
          changed.push(t('moderation.autorole.changed_bye_message'));
        }
        text = text.replace(byeMsgMatch[0], '').trim();
      }

      if (text.toLocaleLowerCase('tr') === 'kapat') {
        patch.autoroleId = null;
        changed.push(t('moderation.autorole.changed_off'));
      } else if (text.length > 0) {
        patch.message = text.slice(0, 400);
        changed.push(t('moderation.autorole.changed_message'));
      }
    }

    const ok = await setWelcomeConfig(guildId, patch);
    if (!ok) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    await ctx.reply(
      successTemplate(
        t('moderation.autorole.saved_title'),
        changed.length > 0 ? changed : [t('moderation.autorole.no_change')],
      ),
    );

    const cfg = await getWelcomeConfig(guildId);
    await ctx.followUp(otorolPayload(t, { cfg, guild: ctx.guild })).catch(() => {});
  },
};
