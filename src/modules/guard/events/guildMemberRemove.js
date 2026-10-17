/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';

export default {
  name: 'guildMemberRemove',
  async execute(member, meta) {
    const guild = member?.guild;
    if (!guild || !member.user) return;

    const { ok } = await guardGate(guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(guild.id);
    if (!config.modules.ban_kick.enabled) return;

    // Yalnizca kick olaylari (normal ayrilmalar audit'te yoktur)
    const resolved = await judgeActor({
      guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'ban_kick',
      auditType: AuditLogEvent.MemberKick,
      targetId: member.id,
      force: true,
    });
    if (resolved.unresolved || resolved.self) return;

    await handleViolation({
      guild,
      client: meta?.client,
      config,
      moduleKey: 'ban_kick',
      type: 'member_kick',
      description: `Üye atıldı (kick): **${member.user.username}** (\`${member.id}\`)`,
      target: `<@${member.id}>`,
      actorResult: resolved,
      restoreFn: null,
    });
  },
};
