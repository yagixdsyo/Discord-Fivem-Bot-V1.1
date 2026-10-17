/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';
import { remapMappedIds, restoreRole, roleSnapshot } from '../lib/restore.js';

export default {
  name: 'roleDelete',
  async execute(role, meta) {
    if (!role?.guild) return;

    const { ok } = await guardGate(role.guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(role.guild.id);
    if (!config.modules.rol.enabled) return;

    // Snapshot olay aninda (uye listesi dahil)
    const snapshot = roleSnapshot(role);
    const actorResult = await judgeActor({
      guild: role.guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'rol',
      auditType: AuditLogEvent.RoleDelete,
      targetId: role.id,
      force: true,
    });

    await handleViolation({
      guild: role.guild,
      client: meta?.client,
      config,
      moduleKey: 'rol',
      type: 'role_delete',
      description: `Yetkisiz rol silme: **@${snapshot.name}** (${snapshot.memberIds?.length ?? 0} üye)`,
      target: `@${snapshot.name}`,
      actorResult,
      restoreFn: async () => {
        const idMap = new Map();
        try {
          const restored = await restoreRole(role.guild, snapshot, { idMap });
          await remapMappedIds(role.guild.id, idMap);
          return { ok: true, target: `@${snapshot.name}`, newId: restored.id };
        } catch (err) {
          return { ok: false, error: err?.message ?? 'geri_kurulamadi' };
        }
      },
    });
  },
};
