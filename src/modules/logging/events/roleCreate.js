/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent, findAuditActor } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'roleCreate',
  async execute(role, meta) {
    if (!role?.guild) return;
    const actor = await findAuditActor(role.guild, AuditLogEvent.RoleCreate, role.id, {
      important: true,
    });
    if (actor?.actorId && meta?.client?.user && actor.actorId === meta.client.user.id) return;

    await emitLog(role.guild, 'log_rol_olustur', {
      actor: actor?.actorId ?? null,
      actorTag: actor?.actorTag ?? null,
      target: role.name,
      lines: [`Yeni rol: <@&${role.id}> \`${role.name}\``],
      ids: [['Rol', role.id]],
    });
  },
};
