/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { button, row } from '../../../ui/v2.js';

export default {
  name: 'aktivite-testi',
  aliases: ['activity-test', 'aktiflik-testi'],
  description: 'Rol sahiplerini bir buton ile katilima cagirir; katilmayanlari rolden dusurur.',
  category: 'Mesai',
  system: 'mesai',
  cooldown: 10,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'rol', type: 'role', required: true, description: 'Test edilecek rol' },
    { name: 'sure', type: 'number', required: false, description: 'Sure (dakika, varsayilan 15)' },
    { name: 'mesaj', type: 'rest', required: false, description: 'Bilgilendirme mesaji' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const minutes = Math.max(1, Math.min(60, Number(ctx.args.sure) || 15));
    const role = ctx.args.rol;
    const guild = ctx.guild;
    const testId = `at-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`;
    const lib = await import('../lib/shifts.js');
    const endAt = new Date(Date.now() + minutes * 60000);
    const channel = await ctx.guild.channels.fetch(ctx.channel.id).catch(() => ctx.channel);
    const panel = card({
      emojiKey: 'EKLE',
      title: t('mesai.activity_title'),
      lines: [
        t('mesai.activity_role', { rol: role.toString() }),
        t('mesai.activity_end', { bitis: `<t:${Math.floor(endAt.getTime() / 1000)}:R>` }),
        ctx.args.mesaj ? t('mesai.activity_message', { mesaj: String(ctx.args.mesaj).slice(0, 300) }) : null,
        t('mesai.activity_hint'),
      ].filter(Boolean),
      accent: 'primary',
      buttons: [row([
        button({ id: `aktiflik:katil:${testId}`, label: t('mesai.activity_join'), emojiKey: 'ONAY', style: 'primary' }),
        button({ id: `aktiflik:durum:${testId}`, label: t('mesai.activity_status'), emojiKey: 'YENILE', style: 'secondary' }),
      ])],
    });
    const message = await ctx.channel.send(panel);
    await lib.createActivityTest({ guildId: guild.id, testId, roleId: role.id, durationMinutes: minutes, channelId: message.channelId, messageId: message.id });
    await ctx.reply(success(t('mesai.activity_created_title'), [t('mesai.activity_created', { id: testId })]));
  },
};
