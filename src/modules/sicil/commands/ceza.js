/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';

function parseEvidence(text) {
  const raw = String(text ?? '');
  const m = raw.match(/kanit:\s*(\S+)/i);
  if (!m) return { evidence: null, reason: raw.trim() };
  const evidence = m[1];
  const reason = raw.replace(/kanit:\s*\S+/i, '').trim() || null;
  return { evidence, reason };
}

export default {
  name: 'ceza',
  aliases: ['ceza-ver', 'sicil-ver'],
  description: 'Warn, kick, ban, unban ve jail kayitlari olusturur.',
  category: 'Ceza ve Sicil',
  system: 'sicil',
  cooldown: 5,
  permission: { discord: ['ModerateMembers'] },
  args: [
    { name: 'islem', type: 'string', required: true, description: 'warn|kick|ban|unban|jail' },
    { name: 'hedef', type: 'user', required: true, description: 'Hedef kullanici' },
    { name: 'sure', type: 'number', required: false, description: 'Minute (ban/jail)' },
    { name: 'sebep', type: 'rest', required: false, description: 'Sebep (kanit:URL eklenebilir)' },
  ],
  async run(ctx) {
    const lib = await import('../lib/cases.js');
    const t = ctx.t;
    const islem = String(ctx.args.islem || '').toLowerCase();
    const target = ctx.args.hedef?.id ? ctx.args.hedef : (ctx.args.hedef ?? {});
    const targetId = String((target.id ?? target.userId ?? ctx.args.hedef) || '').trim();
    if (!targetId || targetId === 'undefined') {
      await ctx.reply(errorTemplate(t('ceza.target_need_title'), [t('ceza.target_need')]));
      return;
    }
    const { evidence, reason } = parseEvidence(ctx.args.sebep || '');
    const sebep = reason || String(ctx.args.sebep || '').trim() || 'Belirtilmedi';
    const minutes = Math.max(0, Number(ctx.args.sure) || 0);

    const member = await ctx.guild.members.fetch(targetId).catch(() => null);
    const targetUser = member?.user ?? await ctx.client.users.fetch(targetId).catch(() => null);

    if (islem === 'warn') {
      const caseId = await lib.createSanction({ guild_id: ctx.guild.id, user_id: targetId, type: 'warn', issued_by: ctx.user.id, reason: sebep, evidence, status: 'aktif' });
      await (await import('../../logging/lib/emit.js')).emitLog?.(ctx.guild, 'log_ceza', { actor: ctx.user.id, actorTag: ctx.user.username, target: targetId, targetTag: targetUser?.username, lines: [t('ceza.warn_log', { kod: caseId, sebep })], accent: 'warn' }).catch(() => {});
      await targetUser?.send(success(t('ceza.warn_dm_title'), [t('ceza.warn_dm', { kod: caseId, sebep })])).catch(() => {});
      await ctx.reply(success(t('ceza.warn_created_title'), [t('ceza.warn_created', { kullanici: `<@${targetId}>`, kod: caseId })]));
      return;
    }

    if (islem === 'kick') {
      if (!member) { await ctx.reply(errorTemplate(t('ceza.member_missing_title'), [t('ceza.member_missing')])); return; }
      const caseId = await lib.createSanction({ guild_id: ctx.guild.id, user_id: targetId, type: 'kick', issued_by: ctx.user.id, reason: sebep, evidence, status: 'tamamlandi' });
      await member.kick(sebep.slice(0, 200)).catch(() => {});
      await (await import('../../logging/lib/emit.js')).emitLog?.(ctx.guild, 'log_ceza', { actor: ctx.user.id, actorTag: ctx.user.username, target: targetId, targetTag: targetUser?.username, lines: [t('ceza.kick_log', { kod: caseId })], accent: 'error' }).catch(() => {});
      await targetUser?.send(errorTemplate(t('ceza.kick_dm_title'), [t('ceza.kick_dm', { sebep })])).catch(() => {});
      await ctx.reply(success(t('ceza.kick_title'), [t('ceza.kick_line', { kullanici: `<@${targetId}>`, kod: caseId })]));
      return;
    }

    if (islem === 'ban') {
      const caseId = await lib.createSanction({ guild_id: ctx.guild.id, user_id: targetId, type: 'ban', issued_by: ctx.user.id, reason: sebep, evidence, status: 'aktif', expires_at: minutes > 0 ? new Date(Date.now() + minutes * 60000).toISOString() : null, minutes });
      await ctx.guild.bans.create(targetId, { reason: sebep.slice(0, 500) }).catch(() => {});
      if (minutes > 0) {
        const { scheduleTask } = await import('../../moderation/lib/schedule.js');
        await scheduleTask({ guildId: ctx.guild.id, kind: 'sicil:unban', runAt: new Date(Date.now() + minutes * 60000), payload: { guildId: ctx.guild.id, caseId }, taskId: `unban:${caseId}` }).catch(() => {});
      }
      await (await import('../../logging/lib/emit.js')).emitLog?.(ctx.guild, 'log_ceza', { actor: ctx.user.id, actorTag: ctx.user.username, target: targetId, targetTag: targetUser?.username, lines: [t('ceza.ban_log', { kod: caseId, sebep, sure: minutes > 0 ? `${minutes} dk` : 'kalici' })], accent: 'error' }).catch(() => {});
      const banDm = minutes > 0
        ? errorTemplate(t('ceza.ban_dm_title'), [t('ceza.ban_dm', { sebep, sure: `${minutes} dk` })])
        : errorTemplate(t('ceza.ban_dm_title'), [t('ceza.ban_dm_permanent', { sebep })]);
      await targetUser?.send(banDm).catch(() => {});
      await ctx.reply(success(t('ceza.ban_title'), [t('ceza.ban_line', { kullanici: `<@${targetId}>`, kod: caseId })]));
      return;
    }

    if (islem === 'unban') {
      await ctx.guild.bans.remove(targetId).catch(() => {});
      const cases = await lib.listSanctions(ctx.guild.id, { userId: targetId, type: 'ban', limit: 20 }).catch(() => []);
      const active = cases.find((x) => x.status !== 'kaldirildi' && x.status !== 'iptal');
      if (active) await lib.updateStatus(ctx.guild.id, active.case_id, 'kaldirildi').catch(() => {});
      await lib.createSanction({ guild_id: ctx.guild.id, user_id: targetId, type: 'unban', issued_by: ctx.user.id, reason: sebep, status: 'tamamlandi' }).catch(() => {});
      await (await import('../../logging/lib/emit.js')).emitLog?.(ctx.guild, 'log_ceza', { actor: ctx.user.id, actorTag: ctx.user.username, target: targetId, targetTag: targetUser?.username, lines: [t('ceza.unban_log', { caseId: active?.case_id ?? 'eski kayit' })], accent: 'success' }).catch(() => {});
      await ctx.reply(success(t('ceza.unban_title'), [t('ceza.unban_line', { kullanici: `<@${targetId}>` })]));
      return;
    }

    if (islem === 'jail') {
      const { getRoleId } = await import('../../fivem/lib/maps.js');
      const jailRoleId = await getRoleId(ctx.guild.id, 'jail') || await getRoleId(ctx.guild.id, 'susturulmus');
      if (!jailRoleId || !member) {
        const caseId = await lib.createSanction({ guild_id: ctx.guild.id, user_id: targetId, type: 'jail', issued_by: ctx.user.id, reason: sebep, evidence, status: 'beklemede' });
        await ctx.reply(success(t('ceza.jail_recorded_title'), [t('ceza.jail_recorded', { kullanici: `<@${targetId}>`, kod: caseId, sebep })]));
        return;
      }
      await member.roles.add(jailRoleId).catch(() => {});
      const caseId = await lib.createSanction({ guild_id: ctx.guild.id, user_id: targetId, type: 'jail', issued_by: ctx.user.id, reason: sebep, evidence, status: 'aktif', minutes, expires_at: minutes > 0 ? new Date(Date.now() + minutes * 60000).toISOString() : null });
      if (minutes > 0) {
        const { scheduleTask } = await import('../../moderation/lib/schedule.js');
        await scheduleTask({ guildId: ctx.guild.id, kind: 'sicil:unban', runAt: new Date(Date.now() + minutes * 60000), payload: { guildId: ctx.guild.id, caseId }, taskId: `jail:${caseId}` }).catch(() => {});
      }
      await targetUser?.send(errorTemplate(t('ceza.jail_dm_title'), [t('ceza.jail_dm', { sebep, sure: minutes > 0 ? `${minutes} dk` : 'süresiz' })])).catch(() => {});
      await ctx.reply(success(t('ceza.jail_title'), [t('ceza.jail_line', { kullanici: `<@${targetId}>`, kod: caseId })]));
      return;
    }

    await ctx.reply(errorTemplate(t('ceza.invalid_action_title'), [t('ceza.invalid_action')]));
  },
};
