/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export default {
  name: '002_logging',

  async up(db, logger) {
    const existing = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name),
    );
    for (const name of ['log_messages', 'log_counters']) {
      if (!existing.has(name)) await db.createCollection(name);
    }

    await db.collection('log_messages').createIndex({ message_id: 1 }, { unique: true });
    await db.collection('log_messages').createIndex({ guild_id: 1, channel_id: 1 }, {});
    await db
      .collection('log_messages')
      .createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });

    await db.collection('log_counters').createIndex({ guild_id: 1, key: 1 }, { unique: true });

    logger.info(
      { collections: 2, indexes: 4 },
      '002_logging: log mesaj korumasi ve sayaç koleksiyonlari hazir',
    );
  },

  async down(db, logger) {
    for (const name of ['log_messages', 'log_counters']) {
      try {
        await db.dropCollection(name);
      } catch {
        /* koleksiyon yoksa sorun degil */
      }
    }
    logger.warn('002_logging geri alindi: log koleksiyonlari silindi');
  },
};
