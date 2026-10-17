/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig, getProtectedRoles } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';
import { hasDangerousPerms } from '../lib/punish.js';
import { consumeSanctioned } from '../lib/sanction.js';

export default {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, meta) {
    const guild = newMember?.guild;
    if (!guild) return;

    const added = newMember.roles?.cache?.filter((role) => !oldMember.roles.cache.has(role.id));
    if (!added || added.size === 0) return;

    const { ok } = await guardGate(guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(guild.id);
    if (!config.modules.yetkili_rol.enabled) return;

    let protectedIds = new Set();
    try {
      protectedIds = new Set((await getProtectedRoles(guild.id)).map((doc) => doc.role_id));
    } catch {
      protectedIds = new Set();
    }

    const dangerousAdded = added.filter(
      (role) => hasDangerousPerms(role.permissions?.bitfield) || protectedIds.has(role.id),
    );
    if (dangerousAdded.size === 0) return;

    // Moderasyon komutlariyla (yetkilendirilmis) verilen roller geri alinmaz.
    let sanctioned = new Set();
    try {
      sanctioned = await consumeSanctioned({ guildId: guild.id, targetId: newMember.id });
    } catch {
      sanctioned = new Set();
    }
    const guarded = dangerousAdded.filter((role) => !sanctioned.has(role.id));
    if (guarded.size === 0) return;

    const names = guarded.map((role) => `@${role.name}`).join(', ');
    const actorResult = await judgeActor({
      guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'yetkili_rol',
      auditType: AuditLogEvent.MemberRoleUpdate,
      targetId: newMember.id,
      force: true,
    });

    await handleViolation({
      guild,
      client: meta?.client,
      config,
      moduleKey: 'yetkili_rol',
      type: 'dangerous_role_grant',
      description: `Tehlikeli/korumalı rol verildi: ${names} → <@${newMember.id}>`,
      target: `<@${newMember.id}>`,
      actorResult,
      restoreFn: async () => {
        const errors = [];
        for (const role of guarded.values()) {
          try {
            await newMember.roles.remove(role.id, 'Guard: yetkisiz rol verme geri alındı');
          } catch {
            errors.push(role.name);
          }
        }
        return errors.length === 0
          ? { ok: true, target: `<@${newMember.id}>` }
          : { ok: false, error: `geri alınamadı: ${errors.join(', ')}` };
      },
    });
  },
};
