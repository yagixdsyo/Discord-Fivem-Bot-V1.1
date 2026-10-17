/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export default {
  name: '003_faz5',

  async up(db, logger) {
    await db.collection('guard_safe').createIndex({ guild_id: 1, user_id: 1 }, { unique: true });
    await db.collection('backups').createIndex({ guild_id: 1, kind: 1, created_at: -1 }, {});

    logger.info({ indexes: 2 }, '003_faz5: guard_safe ve backups indeksleri hazir');
  },

  async down(db, logger) {
    try {
      await db.collection('guard_safe').dropIndex('guild_id_1_user_id_1');
    } catch {
      /* yoksa sorun degil */
    }
    logger.warn('003_faz5 geri alindi');
  },
};
