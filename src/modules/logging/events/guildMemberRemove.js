/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent, findAuditActor } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'guildMemberRemove',
  async execute(member) {
    if (!member?.guild) return;

    // Kick mi? (audit log) - ise yalnizca kick logu dusulur
    const kick = await findAuditActor(member.guild, AuditLogEvent.MemberKick, member.id, {
      important: true,
    });
    if (kick?.actorId) {
      await emitLog(member.guild, 'log_kick', {
        actor: kick.actorId,
        actorTag: kick.actorTag,
        reason: kick.reason,
        target: member.id,
        targetTag: member.user?.username ?? null,
        ids: [['Üye', member.id]],
      });
      return;
    }

    const joinedSec = member.joinedTimestamp
      ? `\n-# Katılma: <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
      : '';
    await emitLog(member.guild, 'log_giris_cikis', {
      target: member.id,
      targetTag: member.user?.username ?? null,
      lines: [`<@${member.id}> sunucudan ayrıldı${joinedSec}`],
      ids: [['Üye', member.id]],
    });
  },
};
