/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../../db/index.js';

/** Varsayilan koleksiyonlar: kurulumun yonettigi kayitlar. */
export const MAP_COLLECTIONS = Object.freeze(['channels_map', 'roles_map', 'panel_messages']);

function nowIso() {
  return new Date().toISOString();
}

/** MongoDB tabanli gercek store. */
export function createDbStore() {
  return {
    /** koleksiyondaki tum kayitlari doner: [{key, channel_id|role_id|message_id, ...}] */
    async getMap(collection, guildId) {
      if (!isDbReady()) return [];
      try {
        return await getCollection(collection).find({ guild_id: guildId }).toArray();
      } catch {
        return [];
      }
    },

    /** key bazli upsert (channels_map / roles_map / panel_messages). */
    async setMap(collection, doc) {
      if (!isDbReady()) return false;
      const now = nowIso();
      await getCollection(collection).updateOne(
        { guild_id: doc.guild_id, key: doc.key },
        { $set: { ...doc, updated_at: now }, $setOnInsert: { created_at: now } },
        { upsert: true },
      );
      return true;
    },

    /** Kurulumun yonettigi esleme kayitlarini siler (sifirlama). */
    async deleteAllMaps(guildId) {
      if (!isDbReady()) return;
      await Promise.all(
        MAP_COLLECTIONS.map((name) => getCollection(name).deleteMany({ guild_id: guildId })),
      );
    },

    /** guild_settings yazimi. */
    async setSetting(guildId, key, value) {
      if (!isDbReady()) return false;
      const now = nowIso();
      await getCollection('guild_settings').updateOne(
        { guild_id: guildId, key },
        { $set: { value, updated_at: now }, $setOnInsert: { created_at: now } },
        { upsert: true },
      );
      return true;
    },

    /** guilds.setup_done guncellemesi. */
    async markSetupDone(guildId, done) {
      if (!isDbReady()) return false;
      const now = nowIso();
      await getCollection('guilds').updateOne(
        { guild_id: guildId },
        {
          $set: { setup_done: Boolean(done), updated_at: now },
          $setOnInsert: { created_at: now },
        },
        { upsert: true },
      );
      return true;
    },

    /** cfg:guild onbellegini gecersiz kil (ayarlar hemen gorunsun). */
    async invalidateGuild(guildId) {
      try {
        const { invalidateGuildConfig } = await import('../../../core/guildSettings.js');
        await invalidateGuildConfig(guildId);
      } catch {
        /* yut */
      }
    },
  };
}
