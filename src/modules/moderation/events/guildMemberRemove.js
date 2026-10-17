/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { recordLeave } from '../lib/invites.js';
import { closeSession } from '../lib/stats.js';
import { moderationActive } from '../lib/gate.js';
import { getWelcomeConfig, sendGoodbye } from '../lib/welcome.js';

export default {
  name: 'guildMemberRemove',
  async execute(member) {
    if (!member?.guild) return;
    await recordLeave(member.guild.id, member.id).catch(() => {});
    await closeSession(member.guild.id, member.id).catch(() => {});
    try {
      if (!(await moderationActive(member.guild.id))) return;
      const cfg = await getWelcomeConfig(member.guild.id);
      if (cfg.byeChannelId) await sendGoodbye(member, cfg);
    } catch {
      /* veda karti basarisiz */
    }
  },
};
