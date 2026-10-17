/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export default {
  name: '005_faz7',

  async up(db, logger) {
    // --- Durum gecmisi ----------------------------------------------------
    await db.collection('fivem_status_history').createIndex({ guild_id: 1, created_at: -1 }, {});

    // --- Kayit sistemi ----------------------------------------------------
    await db.collection('registrations').createIndex({ guild_id: 1, created_at: -1 }, {});
    await db.collection('registrations').createIndex({ guild_id: 1, actor_id: 1, created_at: -1 }, {});
    await db.collection('registrations').createIndex({ guild_id: 1, user_id: 1 }, {});

    // --- Isim onay talepleri ---------------------------------------------
    await db.collection('name_requests').createIndex({ guild_id: 1, status: 1 }, {});
    await db.collection('name_requests').createIndex({ guild_id: 1, request_id: 1 }, { unique: true });

    // --- Destek bekleme / destek kayitlari --------------------------------
    await db.collection('support_waits').createIndex({ guild_id: 1, user_id: 1 }, { unique: true });
    await db.collection('support_records').createIndex({ guild_id: 1, actor_id: 1, created_at: -1 }, {});
    await db.collection('support_records').createIndex({ guild_id: 1, user_id: 1 }, {});

    // --- Mulakat ------------------------------------------------------------
    await db.collection('interviews').createIndex({ guild_id: 1, status: 1 }, {});
    await db.collection('interviews').createIndex({ guild_id: 1, user_id: 1 }, {});

    // --- Olusum -------------------------------------------------------------
    await db.collection('olusums').createIndex({ guild_id: 1, active: 1 }, {});
    await db.collection('olusums').createIndex({ guild_id: 1, name: 1 }, { unique: true });
    await db.collection('olusum_bans').createIndex({ guild_id: 1, olusum_id: 1 }, {});
    await db.collection('olusum_perms').createIndex({ guild_id: 1, status: 1 }, {});

    // --- Ekipler ------------------------------------------------------------
    await db.collection('teams').createIndex({ guild_id: 1, type: 1, active: 1 }, {});
    await db.collection('teams').createIndex({ guild_id: 1, team_id: 1 }, { unique: true });

    // --- Donate / sikayet / feedback ---------------------------------------
    await db.collection('donate_records').createIndex({ guild_id: 1, created_at: -1 }, {});
    await db.collection('donate_records').createIndex({ guild_id: 1, user_id: 1 }, {});
    await db.collection('complaints').createIndex({ guild_id: 1, status: 1 }, {});
    await db.collection('complaints').createIndex({ guild_id: 1, complaint_id: 1 }, { unique: true });
    await db.collection('feedback').createIndex({ guild_id: 1, officer_id: 1, created_at: -1 }, {});
    await db.collection('feedback').createIndex({ guild_id: 1, user_id: 1 }, {});

    // --- Tepki rolleri -------------------------------------------------------
    await db.collection('reaction_roles').createIndex({ guild_id: 1, message_id: 1 }, {});
    await db.collection('reaction_roles').createIndex(
      { guild_id: 1, message_id: 1, emoji_key: 1 },
      { unique: true },
    );

    // --- Ozel odalar ---------------------------------------------------------
    await db.collection('rooms').createIndex({ guild_id: 1, owner_id: 1 }, {});
    await db.collection('rooms').createIndex({ guild_id: 1, channel_id: 1 }, { unique: true });
    await db.collection('room_bans').createIndex({ guild_id: 1, room_id: 1, user_id: 1 }, { unique: true });

    // --- Kurallar / oylama ----------------------------------------------------
    await db.collection('rules_pages').createIndex({ guild_id: 1 }, { unique: true });
    await db.collection('polls').createIndex({ guild_id: 1, status: 1 }, {});
    await db.collection('polls').createIndex({ guild_id: 1, poll_id: 1 }, { unique: true });

    // --- DM duyuru --------------------------------------------------------------
    await db.collection('dm_logs').createIndex({ guild_id: 1, created_at: -1 }, {});
    await db.collection('dm_logs').createIndex({ guild_id: 1, status: 1 }, {});

    // --- CFX olay kayitlari (webhook) --------------------------------------------
    await db.collection('cfx_event_logs').createIndex({ guild_id: 1, created_at: -1 }, {});

    logger.info({ indexes: 23 }, '005_faz7: FiveM modulu indeksleri hazir');
  },

  async down(db, logger) {
    const drops = [
      ['fivem_status_history', 'guild_id_1_created_at_-1'],
      ['registrations', 'guild_id_1_created_at_-1'],
      ['registrations', 'guild_id_1_actor_id_1_created_at_-1'],
      ['registrations', 'guild_id_1_user_id_1'],
      ['name_requests', 'guild_id_1_status_1'],
      ['name_requests', 'guild_id_1_request_id_1'],
      ['support_waits', 'guild_id_1_user_id_1'],
      ['support_records', 'guild_id_1_actor_id_1_created_at_-1'],
      ['support_records', 'guild_id_1_user_id_1'],
      ['interviews', 'guild_id_1_status_1'],
      ['interviews', 'guild_id_1_user_id_1'],
      ['olusums', 'guild_id_1_active_1'],
      ['olusums', 'guild_id_1_name_1'],
      ['olusum_bans', 'guild_id_1_olusum_id_1'],
      ['olusum_perms', 'guild_id_1_status_1'],
      ['teams', 'guild_id_1_type_1_active_1'],
      ['teams', 'guild_id_1_team_id_1'],
      ['donate_records', 'guild_id_1_created_at_-1'],
      ['donate_records', 'guild_id_1_user_id_1'],
      ['complaints', 'guild_id_1_status_1'],
      ['complaints', 'guild_id_1_complaint_id_1'],
      ['feedback', 'guild_id_1_officer_id_1_created_at_-1'],
      ['feedback', 'guild_id_1_user_id_1'],
      ['reaction_roles', 'guild_id_1_message_id_1'],
      ['reaction_roles', 'guild_id_1_message_id_1_emoji_key_1'],
      ['rooms', 'guild_id_1_owner_id_1'],
      ['rooms', 'guild_id_1_channel_id_1'],
      ['room_bans', 'guild_id_1_room_id_1_user_id_1'],
      ['rules_pages', 'guild_id_1'],
      ['polls', 'guild_id_1_status_1'],
      ['polls', 'guild_id_1_poll_id_1'],
      ['dm_logs', 'guild_id_1_created_at_-1'],
      ['dm_logs', 'guild_id_1_status_1'],
      ['cfx_event_logs', 'guild_id_1_created_at_-1'],
    ];
    for (const [collection, index] of drops) {
      await db.collection(collection).dropIndex(index).catch(() => {});
    }
    logger.warn('005_faz7 geri alindi');
  },
};
