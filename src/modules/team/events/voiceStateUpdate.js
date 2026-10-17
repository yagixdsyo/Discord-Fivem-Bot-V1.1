/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { systemReady } from '../../fivem/lib/gate.js';
import { onVoiceUpdate } from '../lib/voice.js';

export default {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const guild = newState?.guild ?? oldState?.guild;
    if (!guild) return;
    const member = newState?.member ?? oldState?.member;
    if (!member || member.user?.bot) return;
    if (oldState?.channelId === newState?.channelId) return;
    if (!(await systemReady(guild.id, 'ekip').catch(() => false))) return;

    await onVoiceUpdate({
      guildId: guild.id,
      userId: member.id,
      oldChannelId: oldState?.channelId ?? null,
      newChannelId: newState?.channelId ?? null,
    }).catch(() => {});
  },
};
