/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent, findAuditActor } from '../../logging/lib/audit.js';
import { moderationActive } from '../lib/gate.js';
import { addRoleLog } from '../lib/store.js';

export default {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, meta) {
    const guild = newMember?.guild;
    if (!guild) return;

    const added = [...newMember.roles.cache.keys()].filter((id) => !oldMember.roles.cache.has(id));
    const removed = [...oldMember.roles.cache.keys()].filter((id) => !newMember.roles.cache.has(id));
    if (added.length === 0 && removed.length === 0) return;
    if (!(await moderationActive(guild.id))) return;

    let actor = null;
    try {
      actor = await findAuditActor(guild, AuditLogEvent.MemberRoleUpdate, newMember.id, {
        important: added.length + removed.length > 3,
      });
    } catch {
      actor = null;
    }

    // Botun kendi islemleri: komut akisinda loglanir, burada tekrar yazilmaz.
    if (actor?.actorId && actor.actorId === meta?.client?.user?.id) return;

    const via = actor?.actorId ? 'sag_tik' : 'bilinmiyor';
    for (const roleId of added) {
      await addRoleLog({
        guildId: guild.id,
        userId: newMember.id,
        roleId,
        action: 'ekle',
        actorId: actor?.actorId ?? null,
        actorTag: actor?.actorTag ?? null,
        via,
      }).catch(() => {});
    }
    for (const roleId of removed) {
      await addRoleLog({
        guildId: guild.id,
        userId: newMember.id,
        roleId,
        action: 'cikar',
        actorId: actor?.actorId ?? null,
        actorTag: actor?.actorTag ?? null,
        via,
      }).catch(() => {});
    }
  },
};
