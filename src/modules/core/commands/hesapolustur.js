/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';

export default {
  name: 'hesapolustur',
  aliases: ['hesap-olustur'],
  description: 'Belirtilen kullanici icin legal site hesabi olusturur.',
  category: 'Bot',
  system: null,
  cooldown: 10,
  permission: { discord: ['ManageGuild'] },
  args: [{ name: 'kullanici', type: 'user', required: false, description: 'Hesap olusturulacak kullanici (varsayilan: kendisi)' }],

  async run(ctx) {
    const t = ctx.t;
    const arg = ctx.args.kullanici;
    const target = arg?.user ?? arg ?? ctx.user;
    const { createSiteClient } = await import('../../../web/siteClient.js');
    const client = await createSiteClient(process.env);
    if (!client.isConfigured()) {
      await ctx.reply(errorTemplate(t('site.not_configured_title'), [t('site.not_configured')]));
      return;
    }
    await ctx.deferReply({ ephemeral: true });
    try {
      const result = await client.createAccount({ discordId: target.id, guildId: ctx.guild.id, requestedBy: ctx.user.id });
      const id = (result && (result.account_id ?? result.id ?? result.site_id)) ?? target.id;
      await ctx.editReply(success(t('site.account_created_title'), [t('site.account_created', { kullanici: `<@${target.id}>`, id: String(id) })]));
    } catch (error) {
      await ctx.editReply(errorTemplate(t('site.api_error_title'), [t('site.api_error', { hata: error?.message ?? String(error) })]));
    }
  },
};
