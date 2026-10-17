/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';

export default {
  name: 'mesai-senkron',
  aliases: ['mesai-sync'],
  description: 'Site ile mesai kayitlarini senkronize eder.',
  category: 'Mesai',
  system: 'mesai',
  cooldown: 10,
  permission: { discord: ['ManageGuild'] },
  args: [],
  async run(ctx) {
    const t = ctx.t;
    const { createSiteClient } = await import('../../../web/siteClient.js');
    const client = await createSiteClient(process.env);
    if (!client.isConfigured()) {
      await ctx.reply(errorTemplate(t('site.not_configured_title'), [t('site.not_configured')]));
      return;
    }
    await ctx.deferReply({ ephemeral: true });
    try {
      const result = await client.syncMesai({ guildId: ctx.guild.id });
      await ctx.editReply(
        card({
          emojiKey: 'YENILE',
          title: t('site.mesai_synced_title'),
          lines: [t('site.mesai_synced', { id: String((result && (result.batch_id ?? result.sync_id)) ?? 'ok') })],
          accent: 'info',
        }),
      );
    } catch (error) {
      await ctx.editReply(errorTemplate(t('site.api_error_title'), [t('site.api_error', { hata: error?.message ?? String(error) })]));
    }
  },
};
