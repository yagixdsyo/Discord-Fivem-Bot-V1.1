/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { findActiveByUser, liftPunishment } from '../lib/store.js';

export default {
  name: 'guildBanRemove',
  async execute(ban) {
    const guild = ban?.guild;
    if (!guild || !ban?.user?.id) return;
    try {
      const active = (await findActiveByUser(guild.id, ban.user.id)).filter((doc) => doc.type === 'ban');
      for (const doc of active) {
        await liftPunishment(guild.id, doc.case_id, { reason: 'Discord üzerinden açıldı' });
      }
    } catch {
      /* senkron kritik degil */
    }
  },
};
