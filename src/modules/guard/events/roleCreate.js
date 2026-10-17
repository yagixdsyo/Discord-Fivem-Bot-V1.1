/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';

export default {
  name: 'roleCreate',
  async execute(role, meta) {
    if (!role?.guild) return;
    if (role.managed) return; // entegrasyon/boost rolü: otomatik olusur

    const { ok } = await guardGate(role.guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(role.guild.id);
    if (!config.modules.rol.enabled) return;

    const actorResult = await judgeActor({
      guild: role.guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'rol',
      auditType: AuditLogEvent.RoleCreate,
      targetId: role.id,
      force: true,
    });

    await handleViolation({
      guild: role.guild,
      client: meta?.client,
      config,
      moduleKey: 'rol',
      type: 'role_create',
      description: `Yetkisiz rol oluşturma: **@${role.name}**`,
      target: `@${role.name}`,
      actorResult,
      restoreFn: async () => {
        try {
          await role.delete('Guard: yetkisiz rol oluşturma');
          return { ok: true, target: `@${role.name}` };
        } catch (err) {
          return { ok: false, error: err?.message ?? 'silinemedi' };
        }
      },
    });
  },
};
