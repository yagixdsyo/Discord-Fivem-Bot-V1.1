/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { getChannelId } from '../lib/maps.js';
import { refreshKayitPanel, setKayitState } from '../lib/kayitFlow.js';

export default {
  name: 'kayıt-aktif',
  aliases: ['kayit-aktif'],
  description: 'Kayıt sistemini açar; kayıt panelini günceller.',
  category: 'FiveM',
  system: 'kayit',
  cooldown: 5,
  permission: { discord: ['ManageNicknames'] },
  args: [{ name: 'kanal', type: 'channel', required: false, description: 'Panel kanalı (varsayılan: kayıt-panel)' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const by = ctx.member?.displayName ?? ctx.user.username;
    await setKayitState(ctx.guild.id, true, by);

    const channel = ctx.args.kanal ?? null;
    const channelId = channel?.id ?? (await getChannelId(ctx.guild.id, 'panel_kayit'));
    const panel = await refreshKayitPanel(ctx.guild, t, { open: true, channelId });

    if (!panel.ok) {
      await ctx.reply(errorTemplate(t('fivem.kayit.channel_missing_title'), [t('fivem.kayit.channel_missing')]));
      return;
    }

    await ctx.reply(
      card({
        emojiKey: 'KAYIT',
        title: t('fivem.kayit.open_title'),
        lines: [
          t('fivem.kayit.open_line', { yetkili: `**${by}**` }),
          channelId ? t('fivem.kayit.panel_channel', { kanal: `<#${channelId}>` }) : t('fivem.kayit.channel_missing'),
        ],
        accent: 'success',
      }),
    );
  },
};
