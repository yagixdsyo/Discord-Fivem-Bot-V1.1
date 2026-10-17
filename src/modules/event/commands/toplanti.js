/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';

function parseDate(value) {
  const match = String(value ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
  return Number.isNaN(date.getTime()) ? null : date;
}

export default {
  name: 'toplanti',
  aliases: ['meeting'],
  description: 'Toplanti olustur, listele, iptal, yoklama.',
  category: 'Etkinlik',
  system: 'toplanti',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'islem', type: 'string', required: true, description: 'olustur|liste|iptal|yoklama' },
    { name: 'ad', type: 'string', required: false, description: 'Toplanti adi' },
    { name: 'tarih', type: 'string', required: false, description: 'YYYY-MM-DD HH:MM' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/meetings.js');
    const islem = String(ctx.args.islem || '').toLowerCase();
    if (islem === 'liste') {
      const rows = await lib.listMeetings(ctx.guild.id, { active: true });
      const lines = rows.map((m) => `${m.meeting_id} — ${m.title} — <t:${Math.floor(new Date(m.starts_at).getTime() / 1000)}:F>`);
      await ctx.reply(listTemplate({ title: t('meeting.list_title'), lines: lines.length ? lines : [t('meeting.list_empty')] }));
      return;
    }
    if (islem === 'iptal') {
      const id = String(ctx.args.ad ?? ctx.args.id ?? '').trim();
      if (!id) { await ctx.reply(errorTemplate(t('meeting.id_need_title'), [t('meeting.id_need')])); return; }
      await lib.cancelMeeting(ctx.guild.id, id);
      await ctx.reply(success(t('meeting.cancelled_title'), [t('meeting.cancelled', { id })]));
      return;
    }
    if (islem === 'yoklama') {
      const id = String(ctx.args.ad ?? '').trim();
      const meeting = await lib.getMeeting(ctx.guild.id, id);
      if (!meeting) { await ctx.reply(errorTemplate(t('meeting.id_need_title'), [t('meeting.id_need')])); return; }
      const channel = meeting.voice_channel_id ? ctx.guild.channels.cache.get(meeting.voice_channel_id) : ctx.guild.channels.cache.find((c) => c.type === 2 && c?.members?.size > 0);
      const presentIds = channel?.members?.map?.((m) => m.id) ?? [];
      await lib.recordMeetingPresence(ctx.guild.id, id, presentIds);
      await ctx.reply(success(t('meeting.attendance_title'), [t('meeting.attendance_line', { sayi: presentIds.length })]));
      return;
    }
    if (islem !== 'olustur') {
      await ctx.reply(errorTemplate(t('meeting.bad_action_title'), [t('meeting.bad_action')]));
      return;
    }
    const ad = String(ctx.args.ad ?? '').trim() || 'Toplanti';
    const when = parseDate(String(ctx.args.tarih ?? '').trim());
    if (!when) { await ctx.reply(errorTemplate(t('meeting.date_need_title'), [t('meeting.date_need')])); return; }
    const doc = await lib.createMeeting({ guildId: ctx.guild.id, title: ad, startsAt: when, voiceChannelId: ctx.channel.id });
    await ctx.reply(success(t('meeting.created_title'), [t('meeting.created', { id: doc.meeting_id, zaman: `<t:${Math.floor(when.getTime()/1000)}:F>` })]));
  },
};
