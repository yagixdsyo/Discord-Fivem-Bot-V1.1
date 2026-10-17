/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent, findAuditActor } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';
import { countBits } from '../lib/helpers.js';

export default {
  name: 'roleUpdate',
  async execute(oldRole, newRole, meta) {
    if (!newRole?.guild) return;
    const lines = [];

    if (oldRole.name !== newRole.name) {
      lines.push(`İsim: \`${oldRole.name}\` -> \`${newRole.name}\``);
    }
    if (oldRole.hexColor !== newRole.hexColor) {
      lines.push(`Renk: ${oldRole.hexColor} -> ${newRole.hexColor}`);
    }
    if (oldRole.hoist !== newRole.hoist) {
      lines.push(`Ayrı göster: ${oldRole.hoist ? 'açık' : 'kapalı'} -> ${newRole.hoist ? 'açık' : 'kapalı'}`);
    }
    if (oldRole.mentionable !== newRole.mentionable) {
      lines.push(
        `Etiketlenebilir: ${oldRole.mentionable ? 'açık' : 'kapalı'} -> ${newRole.mentionable ? 'açık' : 'kapalı'}`,
      );
    }

    const oldPerms = BigInt(oldRole.permissions.bitfield);
    const newPerms = BigInt(newRole.permissions.bitfield);
    if (oldPerms !== newPerms) {
      const added = newPerms & ~oldPerms;
      const removed = oldPerms & ~newPerms;
      lines.push(
        `İzinler değişti: +${countBits(added)} / -${countBits(removed)}`,
      );
    }

    if (lines.length === 0) return;

    const actor = await findAuditActor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id, {
      important: oldPerms !== newPerms,
    });
    if (actor?.actorId && meta?.client?.user && actor.actorId === meta.client.user.id) return;

    await emitLog(newRole.guild, 'log_rol_guncelle', {
      actor: actor?.actorId ?? null,
      actorTag: actor?.actorTag ?? null,
      target: newRole.name,
      lines,
      ids: [['Rol', newRole.id]],
    });
  },
};
