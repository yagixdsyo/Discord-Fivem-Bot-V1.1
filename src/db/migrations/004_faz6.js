/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export default {
  name: '004_faz6',

  async up(db, logger) {
    // --- warnings ---------------------------------------------------------
    await db.collection('warnings').dropIndex('guild_id_1_user_id_1').catch(() => {});
    await db.collection('warnings').createIndex({ guild_id: 1, warning_id: 1 }, { unique: true });
    await db.collection('warnings').createIndex({ guild_id: 1, user_id: 1, active: 1 }, {});
    await db.collection('warnings').createIndex({ guild_id: 1, active: 1, next_decay_at: 1 }, {});

    // --- punishments ------------------------------------------------------
    await db.collection('punishments').createIndex({ guild_id: 1, case_id: 1 }, { unique: true });
    await db.collection('punishments').createIndex({ guild_id: 1, user_id: 1, type: 1, active: 1 }, {});
    await db.collection('punishments').createIndex({ guild_id: 1, user_id: 1, created_at: -1 }, {});

    // --- ban_appeals ------------------------------------------------------
    await db.collection('ban_appeals').createIndex({ guild_id: 1, appeal_id: 1 }, { unique: true });

    // --- timed_tasks (yeni) ----------------------------------------------
    await db.collection('timed_tasks').createIndex({ task_id: 1 }, { unique: true });
    await db.collection('timed_tasks').createIndex({ status: 1, run_at: 1 }, {});
    await db.collection('timed_tasks').createIndex({ guild_id: 1, kind: 1, status: 1 }, {});

    // --- voice_sessions (yeni) -------------------------------------------
    await db.collection('voice_sessions').createIndex({ guild_id: 1, user_id: 1, left_at: 1 }, {});
    await db.collection('voice_sessions').createIndex({ left_at: 1, joined_at: 1 }, {});

    // --- stats_daily (yeni) ----------------------------------------------
    await db.collection('stats_daily').createIndex({ guild_id: 1, user_id: 1, day: 1 }, { unique: true });
    await db.collection('stats_daily').createIndex({ guild_id: 1, day: 1, messages: -1 }, {});

    // --- invite_uses ------------------------------------------------------
    await db.collection('invite_uses').dropIndex('guild_id_1_user_id_1_at_-1').catch(() => {});
    await db.collection('invite_uses').createIndex({ guild_id: 1, inviter_id: 1, joined_at: -1 }, {});
    await db.collection('invite_uses').createIndex({ guild_id: 1, invited_id: 1 }, {});

    // --- role_logs --------------------------------------------------------
    await db.collection('role_logs').createIndex({ guild_id: 1, role_id: 1, at: -1 }, {});

    logger.info({ indexes: 15 }, '004_faz6: moderasyon koleksiyon ve indeksleri hazir');
  },

  async down(db, logger) {
    const drops = [
      ['warnings', 'guild_id_1_warning_id_1'],
      ['warnings', 'guild_id_1_user_id_1_active_1'],
      ['warnings', 'guild_id_1_active_1_next_decay_at_1'],
      ['punishments', 'guild_id_1_case_id_1'],
      ['punishments', 'guild_id_1_user_id_1_type_1_active_1'],
      ['punishments', 'guild_id_1_user_id_1_created_at_-1'],
      ['ban_appeals', 'guild_id_1_appeal_id_1'],
      ['timed_tasks', 'task_id_1'],
      ['timed_tasks', 'status_1_run_at_1'],
      ['timed_tasks', 'guild_id_1_kind_1_status_1'],
      ['voice_sessions', 'guild_id_1_user_id_1_left_at_1'],
      ['voice_sessions', 'left_at_1_joined_at_1'],
      ['stats_daily', 'guild_id_1_user_id_1_day_1'],
      ['stats_daily', 'guild_id_1_day_1_messages_-1'],
      ['invite_uses', 'guild_id_1_inviter_id_1_joined_at_-1'],
      ['invite_uses', 'guild_id_1_invited_id_1'],
      ['role_logs', 'guild_id_1_role_id_1_at_-1'],
    ];
    for (const [collection, index] of drops) {
      await db.collection(collection).dropIndex(index).catch(() => {});
    }
    await db.collection('warnings').createIndex({ guild_id: 1, user_id: 1 }, { unique: true, sparse: true }).catch(() => {});
    logger.warn('004_faz6 geri alindi (bazi indeksler veri nedeniyle birakilmis olabilir)');
  },
};
