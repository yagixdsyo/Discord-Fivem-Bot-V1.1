/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { rememberMessage } from '../lib/cache.js';

export default {
  name: 'messageCreate',
  async execute(message) {
    if (!message?.guildId || message.author?.bot) return;
    rememberMessage(message);
  },
};
