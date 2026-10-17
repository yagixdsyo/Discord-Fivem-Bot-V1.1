/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig, getProtectedRoles } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';
import { getNightDoc } from '../lib/night.js';
import { emitLog } from '../../logging/lib/emit.js';

export default {
  name: 'roleUpdate',
  async execute(oldRole, newRole, meta) {
    const guild = newRole?.guild;
    if (!guild) return;

    const isEveryone = newRole.id === guild.id;
    const permsChanged = oldRole?.permissions !== undefined && newRole.permissions?.bitfield !== oldRole.permissions?.bitfield;
    const nameChanged = oldRole?.name !== undefined && newRole.name !== oldRole.name;
    const colorChanged = oldRole?.color !== undefined && newRole.color !== oldRole.color;
    const hoistChanged = oldRole?.hoist !== undefined && Boolean(newRole.hoist) !== Boolean(oldRole.hoist);
    const mentionableChanged = oldRole?.mentionable !== undefined && Boolean(newRole.mentionable) !== Boolean(oldRole.mentionable);

    if (!permsChanged && !nameChanged && !colorChanged && !hoistChanged && !mentionableChanged) return;

    // Gece modu uyarisi (12.5): snapshot'taki rol elle degistirildi
    if (permsChanged) {
      try {
        const nightDoc = await getNightDoc(guild.id);
        const snap = Array.isArray(nightDoc.snapshot) ? nightDoc.snapshot.find((s) => s.role_id === newRole.id) : null;
        if (nightDoc.sleeping && snap) {
          await emitLog(guild, 'log_gece_modu', {
            accent: 'warn',
            lines: [
              `Gece modu sırasında **@${newRole.name}** rolünün izinleri elle değiştirildi.`,
              'Snapshot güncellenmedi; pencere bitiminde eski izinler geri yüklenecek.',
            ],
          });
        }
      } catch {
        /* uyari logu kritik degil */
      }
    }

    const { ok } = await guardGate(guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(guild.id);
    const moduleKey = isEveryone ? 'guvenli_rol' : 'rol_perm';
    if (!config.modules[moduleKey].enabled) return;

    let protectedIds = new Set();
    if (!isEveryone && (nameChanged || colorChanged || hoistChanged || mentionableChanged)) {
      try {
        protectedIds = new Set((await getProtectedRoles(guild.id)).map((doc) => doc.role_id));
      } catch {
        protectedIds = new Set();
      }
      if (!protectedIds.has(newRole.id) && !permsChanged) return; // korumali degil, sadece kozmetik degisim
    }

    const actorResult = await judgeActor({
      guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey,
      auditType: AuditLogEvent.RoleUpdate,
      targetId: newRole.id,
      force: true,
    });

    const parts = [];
    if (permsChanged) parts.push('izinler');
    if (nameChanged) parts.push(`isim: \`${oldRole.name}\` → \`${newRole.name}\``);
    if (colorChanged) parts.push('renk');
    if (hoistChanged) parts.push('ayrı gösterim');
    if (mentionableChanged) parts.push('etiketlenebilir');

    await handleViolation({
      guild,
      client: meta?.client,
      config,
      moduleKey,
      type: isEveryone ? 'everyone_update' : 'role_update',
      description: isEveryone
        ? '**@everyone** izinleri değiştirildi'
        : `Rol değişikliği: **@${newRole.name}** (${parts.join(', ')})`,
      target: `@${oldRole.name}`,
      actorResult,
      restoreFn: async () => {
        const errors = [];
        const reason = 'Guard: rol değişikliği geri alındı';
        if (permsChanged) await newRole.setPermissions(BigInt(oldRole.permissions.bitfield), reason).catch(() => errors.push('izinler'));
        if (nameChanged) await newRole.setName(oldRole.name, reason).catch(() => errors.push('isim'));
        if (colorChanged) await newRole.setColor(oldRole.color, reason).catch(() => errors.push('renk'));
        if (hoistChanged) await newRole.setHoist(Boolean(oldRole.hoist), reason).catch(() => errors.push('ayrı gösterim'));
        if (mentionableChanged) await newRole.setMentionable(Boolean(oldRole.mentionable), reason).catch(() => errors.push('etiketlenebilir'));
        return errors.length === 0
          ? { ok: true, target: `@${oldRole.name}` }
          : { ok: false, error: `geri alınamadı: ${errors.join(', ')}` };
      },
    });
  },
};
