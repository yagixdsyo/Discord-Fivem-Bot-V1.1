/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';

export default {
  name: 'mazeret-bildir',
  aliases: ['leave-request'],
  description: 'Mazeret kaydi olusturur (onaya sunulur).',
  category: 'Mesai',
  system: 'mesai',
  cooldown: 10,
  permission: { discord: [] },
  args: [
    { name: 'baslangic', type: 'string', required: true, description: 'Baslangic tarihi-saati (YYYY-MM-DD HH:MM)' },
    { name: 'bitis', type: 'string', required: true, description: 'Bitis tarihi-saati (YYYY-MM-DD HH:MM)' },
    { name: 'sebep', type: 'rest', required: true, description: 'Mazeret sebebi' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const start = parseDate(ctx.args.baslangic);
    const end = parseDate(ctx.args.bitis);
    if (!start || !end || start >= end) {
      await ctx.reply(errorTemplate(t('mesai.leave_invalid_title'), [t('mesai.leave_invalid')]));
      return;
    }
    const lib = await import('../lib/shifts.js');
    const leave = await lib.createLeaveRequest({ guildId: ctx.guild.id, userId: ctx.user.id, start: start.toISOString(), end: end.toISOString(), reason: ctx.args.sebep });
    const chId = ctx.guild.systemChannelId ?? ctx.channel.id;
    const ch = ctx.guild.channels.cache.get(chId) ?? (await ctx.guild.channels.fetch(chId).catch(() => null));
    if (ch?.send) {
      const { button, row } = await import('../../../ui/v2.js');
      const { card } = await import('../../../ui/templates/base.js');
      await ch.send(card({
        emojiKey: 'MAZERET',
        title: t('mesai.leave_submitted_title'),
        lines: [
          t('mesai.leave_user', { kullanici: `<@${leave.user_id}>` }),
          t('mesai.leave_period', { baslangic: `<t:${Math.floor(start.getTime()/1000)}:F>`, bitis: `<t:${Math.floor(end.getTime()/1000)}:F>` }),
          t('mesai.leave_reason', { sebep: leave.reason }),
        ],
        accent: 'info',
        buttons: [row([
          button({ id: `mazeret:onay:${leave.leave_id}`, label: t('common.approve'), emojiKey: 'ONAY', style: 'primary' }),
          button({ id: `mazeret:red:${leave.leave_id}`, label: t('common.deny'), emojiKey: 'RED', style: 'danger' }),
        ])],
      })).catch(() => {});
    }
    await ctx.reply(success(t('mesai.leave_created_title'), [t('mesai.leave_created', { id: leave.leave_id })]));
  },
};

function parseDate(value) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}
