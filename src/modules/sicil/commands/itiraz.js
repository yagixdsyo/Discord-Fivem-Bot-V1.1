/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { button, row } from '../../../ui/v2.js';

export default {
  name: 'itiraz',
  aliases: ['itiraz-baslat'],
  description: 'Verilen bir cezaya itiraz baslatir.',
  category: 'Ceza ve Sicil',
  system: 'sicil',
  cooldown: 10,
  permission: { discord: [] },
  args: [
    { name: 'ceza_id', type: 'string', required: true, description: 'Case kodu' },
    { name: 'sebep', type: 'rest', required: true, description: 'Itiraz sebebi' },
  ],
  async run(ctx) {
    const lib = await import('../lib/cases.js');
    const t = ctx.t;
    const caseId = String(ctx.args.ceza_id || '').trim();
    const sebep = String(ctx.args.sebep || '').trim();
    const doc = await lib.getSanction(ctx.guild.id, caseId).catch(() => null);
    if (!doc || doc.user_id !== ctx.user.id) {
      await ctx.reply(errorTemplate(t('ceza.itiraz_denied_title'), [t('ceza.itiraz_denied')]));
      return;
    }
    const appealId = await lib.createAppeal({ guildId: ctx.guild.id, caseId, userId: ctx.user.id, reason: sebep });
    await ctx.reply(success(t('ceza.itiraz_created_title'), [t('ceza.itiraz_created', { case: caseId, appeal: appealId })]));

    // Yetkili incelemesi icin butonlu V2 karti (ban itiraz log kanali).
    try {
      const { resolveLogChannelId } = await import('../../logging/lib/cache.js');
      const channelId = await resolveLogChannelId(ctx.guild.id, 'log_ban_itiraz').catch(() => null);
      const channel = channelId ? ctx.guild.channels.cache.get(channelId) ?? (await ctx.guild.channels.fetch(channelId).catch(() => null)) : null;
      if (channel?.send) {
        await channel.send(card({
          emojiKey: 'BAN',
          title: t('ceza.appeal_review_title', { id: appealId }),
          lines: [
            t('ceza.appeal_review_case', { case: caseId }),
            t('ceza.appeal_review_user', { kullanici: `<@${ctx.user.id}>` }),
            t('ceza.appeal_review_reason', { sebep }),
          ],
          accent: 'warn',
          buttons: [row([
            button({ id: `itiraz:onay:${appealId}`, label: t('common.approve'), emojiKey: 'OK_SAG', style: 'success' }),
            button({ id: `itiraz:red:${appealId}`, label: t('common.deny'), emojiKey: 'RED', style: 'danger' }),
          ])],
        })).catch(() => {});
      }
    } catch {}
  },
};
