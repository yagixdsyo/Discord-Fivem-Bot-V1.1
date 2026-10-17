/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent, findAuditActor } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const guild = newState.guild ?? oldState.guild ?? null;
    if (!guild) return;
    const member = newState.member ?? oldState.member ?? null;
    const targetId = member?.id ?? newState.id ?? oldState.id ?? null;
    const targetTag = member?.user?.username ?? null;

    // 1) Kanal degisimi: katilma / ayrilma / tasinma
    if (!oldState.channelId && newState.channelId) {
      await emitLog(guild, 'log_ses_giris_cikis', {
        target: targetId,
        targetTag,
        lines: [`<@${targetId}> ses kanalına katıldı: <#${newState.channelId}>`],
      });
    } else if (oldState.channelId && !newState.channelId) {
      await emitLog(guild, 'log_ses_giris_cikis', {
        target: targetId,
        targetTag,
        lines: [`<@${targetId}> ses kanalından ayrıldı: <#${oldState.channelId}>`],
      });
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const actor = await findAuditActor(guild, AuditLogEvent.MemberMove, targetId, {
        important: false,
      });
      await emitLog(guild, 'log_ses_tasima', {
        actor: actor?.actorId ?? null,
        actorTag: actor?.actorTag ?? null,
        target: targetId,
        targetTag,
        lines: [`<@${targetId}> taşındı: <#${oldState.channelId}> -> <#${newState.channelId}>`],
      });
    }

    // 2) Kendi mic/kulaklik degisimi
    if (oldState.selfMute !== newState.selfMute || oldState.selfDeaf !== newState.selfDeaf) {
      const lines = [
        `Mikrofon: ${newState.selfMute ? 'kapalı' : 'açık'}`,
        `Kulaklık: ${newState.selfDeaf ? 'kapalı' : 'açık'}`,
        newState.channelId ? `Kanal: <#${newState.channelId}>` : null,
      ].filter(Boolean);
      await emitLog(guild, 'log_mic_kulaklik', {
        target: targetId,
        targetTag,
        lines,
      });
    }
  },
};
