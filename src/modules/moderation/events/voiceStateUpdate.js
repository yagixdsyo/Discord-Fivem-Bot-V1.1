/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { moderationActive } from '../lib/gate.js';
import { closeSession, openSession } from '../lib/stats.js';

export default {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const guild = newState?.guild ?? oldState?.guild;
    if (!guild) return;

    const member = newState.member ?? oldState.member;
    if (member?.user?.bot) return;
    if (oldState.channelId === newState.channelId) return; // mute/sagir degisiklikleri
    if (!(await moderationActive(guild.id))) return;

    if (newState.channelId) {
      await openSession(guild.id, newState.id, newState.channelId);
    } else {
      await closeSession(guild.id, oldState.id);
    }
  },
};
