/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';

export default {
  name: 'gorev',
  aliases: [],
  description: 'Gorev olustur, ata, teslim et, onayla/red et ve listele.',
  category: 'Gorev',
  system: 'gorev',
  cooldown: 5,
  permission: { discord: [] },
  args: [{ name: 'islem', type: 'string', required: true, description: 'olustur|ata|teslim|onayla|reddet|liste|yuk' },
         { name: 'parametre', type: 'rest', required: false, description: 'Parametreler' }],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/tasks.js');
    const islem = String(ctx.args.islem || '').toLowerCase();
    const raw = String(ctx.args.parametre || '').trim();
    const pieces = raw.split(/\s+/).filter(Boolean);

    if (islem === 'olustur' || islem === 'baslik') {
      const title = pieces.join(' ') || 'Yeni görev';
      const task = await lib.createTask({ guildId: ctx.guild.id, title, createdBy: ctx.user.id });
      await ctx.reply(success(t('task.created_title'), [t('task.created', { id: task.task_id, ad: title })]));
      return;
    }
    if (islem === 'ata') {
      const taskId = pieces[0], targetArg = pieces[1], target = targetArg?.match(/<@!?(\d+)>/)?.[1] ?? (/^\d+$/.test(targetArg||'') ? targetArg : null), reason = pieces.slice(2).join(' ');
      if (!taskId || !target) { await ctx.reply(errorTemplate(t('task.assign_missing_title'), [t('task.assign_missing')])); return; }
      const res = await lib.assignTask({ guildId: ctx.guild.id, taskId, assigneeId: target, actorId: ctx.user.id, reason });
      if (!res.ok) { await ctx.reply(errorTemplate(t('task.assign_fail_title'), [t('task.assign_fail')])); return; }
      await ctx.reply(success(t('task.assigned_title'), [t('task.assigned', { id: taskId, kullanici: `<@${target}>` })]));
      return;
    }
    if (islem === 'teslim' || islem === 'teslim-et') {
      const taskId = pieces[0], evidence = pieces.slice(1).join(' ');
      if (!taskId) { await ctx.reply(errorTemplate(t('task.submit_missing_title'), [t('task.submit_missing')])); return; }
      const res = await lib.submitTask({ guildId: ctx.guild.id, taskId, userId: ctx.user.id, evidence, note: evidence });
      if (!res.ok) { await ctx.reply(errorTemplate(t('task.submit_fail_title'), [t('task.submit_fail')])); return; }
      await ctx.reply(success(t('task.submitted_title'), [t('task.submitted', { id: taskId })]));
      return;
    }
    if (islem === 'onayla') {
      const taskId = pieces[0];
      if (!taskId) { await ctx.reply(errorTemplate(t('task.approve_missing_title'), [t('task.approve_missing')])); return; }
      const res = await lib.approveTask({ guildId: ctx.guild.id, taskId, reviewerId: ctx.user.id });
      if (!res.ok) { await ctx.reply(errorTemplate(t('task.approve_fail_title'), [t('task.approve_fail')])); return; }
      await ctx.reply(success(t('task.approved_title'), [t('task.approved', { id: taskId })]));
      return;
    }
    if (islem === 'reddet') {
      const taskId = pieces[0], reason = pieces.slice(1).join(' ');
      if (!taskId) { await ctx.reply(errorTemplate(t('task.reject_missing_title'), [t('task.reject_missing')])); return; }
      const res = await lib.rejectTask({ guildId: ctx.guild.id, taskId, reviewerId: ctx.user.id, reason });
      if (!res.ok) { await ctx.reply(errorTemplate(t('task.reject_fail_title'), [t('task.reject_fail')])); return; }
      await ctx.reply(success(t('task.rejected_title'), [t('task.rejected', { id: taskId })]));
      return;
    }
    if (islem === 'liste' || islem === 'list') {
      const rows = await lib.listTasks(ctx.guild.id);
      const lines = rows.map((x) => `${x.task_id} — ${x.title} [${x.status}] — ${ (x.assigned_to||[]).map(u=>`<@${u}>`).join(', ')||'atama yok' }`);
      await ctx.reply(lines.length ? listTemplate({ title: t('task.list_title'), lines }) : success(t('task.list_empty_title'), [t('task.list_empty')]));
      return;
    }
    if (islem === 'yuk' || islem === 'workload') {
      const rows = await lib.workload(ctx.guild.id);
      const lines = rows.map((x)=>`<@${x.userId}>: ${x.count} açık görev`);
      await ctx.reply(lines.length ? listTemplate({ title: t('task.workload_title'), lines }) : success(t('task.workload_empty_title'), [t('task.workload_empty')]));
      return;
    }
    await ctx.reply(errorTemplate(t('task.unknown_action_title'), [t('task.unknown_action')]));
  },
};
