/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export default {
  name: '006_faz8',

  async up(db, logger) {
    // Ticket
    await db.collection('tickets').createIndex({ guild_id: 1, ticket_id: 1 }, { unique: true });
    await db.collection('tickets').createIndex({ guild_id: 1, status: 1, opened_at: -1 }, {});
    await db.collection('tickets').createIndex({ guild_id: 1, user_id: 1, status: 1 }, {});
    await db.collection('tickets').createIndex({ channel_id: 1 }, { unique: true });
    await db.collection('ticket_notes').createIndex({ guild_id: 1, ticket_id: 1, at: -1 }, {});
    await db.collection('ticket_ratings').createIndex({ guild_id: 1, ticket_id: 1 }, { unique: true });

    // Mesai / birim / mazeret
    await db.collection('shifts').createIndex({ guild_id: 1, user_id: 1, started_at: -1 }, {});
    await db.collection('shifts').createIndex({ guild_id: 1, status: 1, started_at: -1 }, {});
    await db.collection('units').createIndex({ guild_id: 1, unit_id: 1 }, { unique: true });
    await db.collection('units').createIndex({ guild_id: 1, active: 1 }, {});
    await db.collection('unit_notes').createIndex({ guild_id: 1, unit_id: 1, at: -1 }, {});
    await db.collection('leave_requests').createIndex({ guild_id: 1, status: 1, created_at: -1 }, {});
    await db.collection('leave_requests').createIndex({ guild_id: 1, user_id: 1 }, {});

    // Aktiflik testi
    await db.collection('activity_tests').createIndex({ guild_id: 1, test_id: 1 }, { unique: true });

    // Etkinlik / toplanti / cekilis
    await db.collection('events').createIndex({ guild_id: 1, event_id: 1 }, { unique: true });
    await db.collection('events').createIndex({ guild_id: 1, status: 1, started_at: -1 }, {});
    await db.collection('meetings').createIndex({ guild_id: 1, meeting_id: 1 }, { unique: true });
    await db.collection('meeting_attendance').createIndex({ guild_id: 1, meeting_id: 1, user_id: 1 }, { unique: true });
    await db.collection('giveaways').createIndex({ guild_id: 1, giveaway_id: 1 }, { unique: true });
    await db.collection('giveaways').createIndex({ status: 1, ended_at: 1 });

    // Başvuru
    await db.collection('applications').createIndex({ guild_id: 1, application_id: 1 }, { unique: true });
    await db.collection('applications').createIndex({ guild_id: 1, type: 1, status: 1 }, {});
    await db.collection('application_responses').createIndex({ guild_id: 1, application_id: 1 }, {});

    // Blacklist
    await db.collection('blacklist_records').createIndex({ guild_id: 1, user_id: 1 }, { unique: true });
    await db.collection('blacklist_records').createIndex({ guild_id: 1, type: 1, created_at: -1 }, {});

    if (logger) logger.info('006_faz8: yeni koleksiyon indeksleri hazir');
  },

  async down(db, logger) {
    for (const name of ['tickets','ticket_notes','ticket_ratings','shifts','units','unit_notes','leave_requests','activity_tests','events','meetings','meeting_attendance','giveaways','applications','application_responses','blacklist_records']) {
      await db.collection(name).drop().catch(() => {});
    }
    if (logger) logger.warn('006_faz8 geri alindi');
  },
};
