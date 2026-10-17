/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { trackInviteDelete } from '../lib/cache.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'inviteDelete',
  async execute(invite) {
    if (!invite?.guild) return;
    trackInviteDelete(invite.guild.id, invite.code);

    await emitLog(invite.guild, 'log_davet', {
      lines: [`Davet silindi: \`${invite.code}\``],
      ids: [['Davet', invite.code]],
    });
  },
};
