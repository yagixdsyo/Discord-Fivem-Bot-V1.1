/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent, findAuditActor } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'guildBanAdd',
  async execute(ban) {
    if (!ban?.guild) return;
    const actor = await findAuditActor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id, {
      important: true,
    });
    await emitLog(ban.guild, 'log_ban', {
      actor: actor?.actorId ?? null,
      actorTag: actor?.actorTag ?? null,
      reason: actor?.reason ?? ban.reason ?? null,
      target: ban.user.id,
      targetTag: ban.user.username ?? null,
      lines: [`<@${ban.user.id}> sunucudan yasaklandı`],
      ids: [['Üye', ban.user.id]],
    });
  },
};
