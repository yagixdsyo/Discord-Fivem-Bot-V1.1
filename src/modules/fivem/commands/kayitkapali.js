/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { getChannelId } from '../lib/maps.js';
import { refreshKayitPanel, setKayitState } from '../lib/kayitFlow.js';

export default {
  name: 'kayıt-kapalı',
  aliases: ['kayit-kapali'],
  description: 'Kayıt sistemini kapatır; panel kapalı duruma geçer.',
  category: 'FiveM',
  system: 'kayit',
  cooldown: 5,
  permission: { discord: ['ManageNicknames'] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const by = ctx.member?.displayName ?? ctx.user.username;
    await setKayitState(ctx.guild.id, false, by);

    const channelId = await getChannelId(ctx.guild.id, 'panel_kayit');
    await refreshKayitPanel(ctx.guild, t, { open: false, channelId });

    await ctx.reply(
      card({
        emojiKey: 'KAYIT',
        title: t('fivem.kayit.closed_title'),
        lines: [t('fivem.kayit.closed_line', { yetkili: `**${by}**` })],
        accent: 'warn',
      }),
    );
  },
};
