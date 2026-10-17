/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent, findAuditActor } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'roleDelete',
  async execute(role, meta) {
    if (!role?.guild) return;
    const actor = await findAuditActor(role.guild, AuditLogEvent.RoleDelete, role.id, {
      important: true,
    });
    if (actor?.actorId && meta?.client?.user && actor.actorId === meta.client.user.id) return;

    await emitLog(role.guild, 'log_rol_sil', {
      actor: actor?.actorId ?? null,
      actorTag: actor?.actorTag ?? null,
      reason: actor?.reason ?? null,
      target: role.name,
      lines: [`Rol silindi: \`${role.name}\``],
      ids: [['Rol', role.id]],
    });
  },
};
