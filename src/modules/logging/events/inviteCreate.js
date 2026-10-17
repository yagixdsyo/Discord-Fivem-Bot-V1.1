/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { trackInvite } from '../lib/cache.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'inviteCreate',
  async execute(invite) {
    if (!invite?.guild) return;

    trackInvite(invite.guild.id, invite.code, {
      uses: invite.uses ?? 0,
      inviterId: invite.inviterId ?? null,
    });

    const lines = [`Davet oluşturuldu: \`${invite.code}\``];
    if (invite.channel) lines.push(`Kanal: <#${invite.channel.id}>`);
    lines.push(`Azami kullanım: ${invite.maxUses ? invite.maxUses : 'sınırsız'}`);
    lines.push(`Geçerlilik: ${invite.maxAge ? `${invite.maxAge} sn` : 'sınırsız'}`);
    if (invite.expiresTimestamp) {
      lines.push(`Bitiş: <t:${Math.floor(invite.expiresTimestamp / 1000)}:R>`);
    }

    await emitLog(invite.guild, 'log_davet', {
      actor: invite.inviterId ?? null,
      lines,
      ids: [['Davet', invite.code]],
    });
  },
};
