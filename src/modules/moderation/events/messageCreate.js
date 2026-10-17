/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { moderationActive } from '../lib/gate.js';
import { addMessage } from '../lib/stats.js';

export default {
  name: 'messageCreate',
  async execute(message) {
    if (!message?.guildId || message.author?.bot) return;
    if (!(await moderationActive(message.guildId))) return;
    addMessage(message.guildId, message.author.id);
  },
};
