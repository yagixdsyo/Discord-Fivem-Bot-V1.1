/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { info as infoTemplate, warn as warnTemplate } from '../../../ui/templates/index.js';
import { logToOwnerChannel, notifyGuildOwner } from './notify.js';
import { setSystemState } from './systems.js';

/**
 * @returns {Promise<{ok: boolean, enabled?: boolean, error?: string}>}
 */
export async function applySystemToggle(ctx, { system, enabled, reason = null }) {
  const t = ctx.t;
  const result = await setSystemState({
    guildId: ctx.guild.id,
    systemId: system.id,
    enabled,
    by: ctx.user.id,
    reason,
  });
  if (!result.ok) return result;

  const actor = ctx.user.username ?? ctx.user.id;
  const lines = [
    t('setup.toggle.log_system', {
      sistem: system.name,
      durum: enabled ? t('setup.toggle.state_on') : t('setup.toggle.state_off'),
    }),
    t('setup.toggle.log_actor', { kullanici: actor }),
  ];
  if (reason) lines.push(t('setup.toggle.reason_line', { sebep: reason }));
  logToOwnerChannel(ctx.config, infoTemplate(t('setup.toggle.log_title'), lines)).catch(() => {});

  // Guard kapatilirken kapatan loglanir ve sunucu sahibine bildirilir.
  if (system.id === 'guard' && !enabled) {
    const dmCard = warnTemplate(t('setup.guard.dm_title'), [
      t('setup.guard.dm_body', {
        sunucu: ctx.guild.name,
        kisi: actor,
        zaman: `<t:${Math.floor(Date.now() / 1000)}:F>`,
      }),
    ]);
    notifyGuildOwner(ctx.guild, ctx.config, dmCard).catch(() => {});
  }

  return result;
}
