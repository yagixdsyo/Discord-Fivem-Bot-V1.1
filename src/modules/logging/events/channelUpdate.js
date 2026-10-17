/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent, findAuditActor } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';
import { permissionDiff } from '../lib/helpers.js';

export default {
  name: 'channelUpdate',
  async execute(oldChannel, newChannel, meta) {
    if (!newChannel?.guild) return;

    const permLines = permissionDiff(oldChannel, newChannel);
    const lines = [];

    if (oldChannel.name !== newChannel.name) {
      lines.push(`İsim: \`${oldChannel.name}\` -> \`${newChannel.name}\``);
    }
    if (oldChannel.parentId !== newChannel.parentId) {
      lines.push(
        `Kategori: ${oldChannel.parentId ? `<#${oldChannel.parentId}>` : 'yok'} -> ${
          newChannel.parentId ? `<#${newChannel.parentId}>` : 'yok'
        }`,
      );
    }
    if (oldChannel.topic !== newChannel.topic) lines.push('Konu güncellendi');
    if (oldChannel.nsfw !== newChannel.nsfw) {
      lines.push(`NSFW: ${oldChannel.nsfw ? 'açık' : 'kapalı'} -> ${newChannel.nsfw ? 'açık' : 'kapalı'}`);
    }
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
      lines.push(`Yavaş mod: ${oldChannel.rateLimitPerUser ?? 0} sn -> ${newChannel.rateLimitPerUser ?? 0} sn`);
    }
    if (oldChannel.userLimit !== newChannel.userLimit) {
      lines.push(`Kullanıcı limiti: ${oldChannel.userLimit ?? 0} -> ${newChannel.userLimit ?? 0}`);
    }

    if (!permLines && lines.length === 0) return;

    const actor = await findAuditActor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id, {
      important: Boolean(permLines),
    });
    if (actor?.actorId && meta?.client?.user && actor.actorId === meta.client.user.id) return;

    const ids = [['Kanal', newChannel.id]];

    if (permLines) {
      await emitLog(newChannel.guild, 'log_izin', {
        actor: actor?.actorId ?? null,
        actorTag: actor?.actorTag ?? null,
        target: `#${newChannel.name}`,
        lines: permLines,
        ids,
      });
    }
    if (lines.length > 0) {
      await emitLog(newChannel.guild, 'log_kanal_guncelle', {
        actor: actor?.actorId ?? null,
        actorTag: actor?.actorTag ?? null,
        target: `#${newChannel.name}`,
        lines,
        ids,
      });
    }
  },
};
