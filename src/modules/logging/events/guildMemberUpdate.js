/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent, findAuditActor } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, meta) {
    if (!newMember?.guild) return;

    // 1) Rol degisimleri (log_rol_ver_al)
    const oldRoles = new Set(oldMember.roles?.cache?.keys() ?? []);
    const newRoles = new Set(newMember.roles?.cache?.keys() ?? []);
    const added = [...newRoles].filter((id) => !oldRoles.has(id));
    const removed = [...oldRoles].filter((id) => !newRoles.has(id));

    if (added.length > 0 || removed.length > 0) {
      const actor = await findAuditActor(
        newMember.guild,
        AuditLogEvent.MemberRoleUpdate,
        newMember.id,
        { important: true },
      );
      if (!(actor?.actorId && meta?.client?.user && actor.actorId === meta.client.user.id)) {
        const lines = [];
        if (added.length > 0) lines.push(`Verilen: ${added.map((id) => `<@&${id}>`).join(', ')}`);
        if (removed.length > 0) lines.push(`Alınan: ${removed.map((id) => `<@&${id}>`).join(', ')}`);
        await emitLog(newMember.guild, 'log_rol_ver_al', {
          actor: actor?.actorId ?? null,
          actorTag: actor?.actorTag ?? null,
          target: newMember.id,
          targetTag: newMember.user?.username ?? null,
          lines,
        });
      }
    }

    // 2) Isim degisikligi (log_isim_degisiklik)
    if (oldMember.nickname !== newMember.nickname) {
      const actor = await findAuditActor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id, {
        important: false,
      });
      const oldTag = oldMember.user?.username ?? null;
      const newTag = newMember.user?.username ?? null;
      const lines = [
        `Takma ad: \`${oldMember.nickname ?? 'yok'}\` -> \`${newMember.nickname ?? 'yok'}\``,
      ];
      if (oldTag !== newTag) lines.push(`Kullanıcı adı: \`${oldTag}\` -> \`${newTag}\``);
      await emitLog(newMember.guild, 'log_isim_degisiklik', {
        actor: actor?.actorId ?? null,
        actorTag: actor?.actorTag ?? null,
        target: newMember.id,
        targetTag: newTag,
        lines,
      });
    }

    // 3) Susturma (timeout) degisikligi (log_mute)
    const oldUntil = oldMember.communicationDisabledUntilTimestamp ?? null;
    const newUntil = newMember.communicationDisabledUntilTimestamp ?? null;
    if (oldUntil !== newUntil) {
      const actor = await findAuditActor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id, {
        important: true,
      });
      const untilSec = newUntil ? Math.floor(newUntil / 1000) : null;
      const lines = [
        newUntil
          ? `Susturma eklendi. Bitiş: <t:${untilSec}:F> (<t:${untilSec}:R>)`
          : 'Susturma kaldırıldı',
      ];
      await emitLog(newMember.guild, 'log_mute', {
        actor: actor?.actorId ?? null,
        actorTag: actor?.actorTag ?? null,
        reason: actor?.reason ?? null,
        target: newMember.id,
        targetTag: newMember.user?.username ?? null,
        lines,
      });
    }
  },
};
