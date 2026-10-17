/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent, findAuditActor } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'guildBanRemove',
  async execute(ban) {
    if (!ban?.guild) return;
    const actor = await findAuditActor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id, {
      important: true,
    });
    await emitLog(ban.guild, 'log_unban', {
      actor: actor?.actorId ?? null,
      actorTag: actor?.actorTag ?? null,
      reason: actor?.reason ?? null,
      target: ban.user.id,
      targetTag: ban.user.username ?? null,
      lines: [`<@${ban.user.id}> yasağı kaldırıldı`],
      ids: [['Üye', ban.user.id]],
    });
  },
};
