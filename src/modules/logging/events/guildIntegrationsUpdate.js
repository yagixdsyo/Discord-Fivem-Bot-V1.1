/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { emitLog } from '../lib/emit.js';

export default {
  name: 'guildIntegrationsUpdate',
  async execute(guild) {
    if (!guild?.id) return;
    await emitLog(guild, 'log_integration', {
      lines: ['Sunucu entegrasyonları güncellendi'],
    });
  },
};
