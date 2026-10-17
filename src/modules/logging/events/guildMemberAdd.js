/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { bus } from '../../../core/bus.js';
import { diffInvites } from '../lib/cache.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    if (!member?.guild) return;
    const createdSec = Math.floor((member.user?.createdTimestamp ?? Date.now()) / 1000);

    await emitLog(member.guild, 'log_giris_cikis', {
      target: member.id,
      targetTag: member.user?.username ?? null,
      lines: [`<@${member.id}> sunucuya katıldı`, `Hesap oluşturma: <t:${createdSec}:R>`],
      ids: [['Üye', member.id]],
    });

    // Davet tespiti: once/sonra kullanim farki
    try {
      const invites = await member.guild.invites.fetch();
      const after = new Map();
      for (const invite of invites.values()) {
        after.set(invite.code, { uses: invite.uses ?? 0, inviterId: invite.inviterId ?? null });
      }
      const used = diffInvites(member.guild.id, after);
      if (used) {
        // Moderasyon davet kaydi ayni tespiti paylasir (tek diff tuketimi).
        bus.emit('invite:used', {
          guildId: member.guild.id,
          memberId: member.id,
          code: used.code,
          inviterId: used.inviterId,
          uses: used.uses,
          delta: used.delta,
        });
        await emitLog(member.guild, 'log_davet', {
          target: member.id,
          targetTag: member.user?.username ?? null,
          actor: used.inviterId,
          lines: [`Davet kodu: \`${used.code}\``, `Kullanım: ${used.uses} (+${used.delta})`],
          ids: [['Davet', used.code]],
        });
      }
    } catch {
      /* davet izni yoksa sessiz gec */
    }
  },
};
