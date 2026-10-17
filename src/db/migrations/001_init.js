/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

const COLLECTIONS = [
  // --- Cekirdek ---
  'guilds',
  'guild_settings',
  'guild_modules',
  'guild_command_overrides',
  'perm_nodes',
  'channels_map',
  'roles_map',
  'panel_messages',
  // --- Bot sahibi ---
  'owner_blacklist',
  'owner_maintenance',
  'owner_announcements',
  'owner_audit',
  // --- Moderasyon ---
  'punishments',
  'warnings',
  'ban_appeals',
  'role_logs',
  // --- Guard ---
  'guard_safe',
  'guard_config',
  'guard_protected_roles',
  'guard_link_whitelist',
  'guard_incidents',
  'guard_night_mode',
  // --- Backup ---
  'backups',
  'message_backups',
  // --- Ticket ---
  'ticket_panels',
  'tickets',
  'ticket_members',
  'ticket_events',
  'ticket_transcripts',
  // --- Ekip / Mesai ---
  'teams',
  'team_members',
  'shifts',
  'shift_totals',
  'shift_config',
  'units',
  'unit_members',
  'excuses',
  'inactivity_checks',
  'activity_tests',
  // --- FiveM ---
  'fivem_config',
  'registrations',
  'registration_counts',
  'whitelist',
  'formations',
  'support_queue',
  'interviews',
  'complaints',
  'feedbacks',
  'donations',
  'meetings',
  'events',
  'giveaways',
  'blacklist_servers',
  'blacklist_users',
  'applications_forms',
  'applications_submissions',
  'private_rooms',
  'support_logs',
  // --- Ek yardimci koleksiyonlar ---
  'command_usage',
  'bot_errors',
  'invites',
  'invite_uses',
  'reaction_roles',
  'guild_rules',
  'polls',
];

/** [koleksiyon, anahtar, secenekler] */
const INDEXES = [
  // Cekirdek
  ['guilds', { guild_id: 1 }, { unique: true }],
  ['guild_settings', { guild_id: 1, key: 1 }, { unique: true }],
  ['guild_modules', { guild_id: 1, module_id: 1 }, { unique: true }],
  ['guild_command_overrides', { guild_id: 1, command: 1 }, { unique: true }],
  ['perm_nodes', { guild_id: 1, node: 1 }, { unique: true }],
  ['channels_map', { guild_id: 1, key: 1 }, { unique: true }],
  ['roles_map', { guild_id: 1, key: 1 }, { unique: true }],
  ['panel_messages', { guild_id: 1, key: 1 }, { unique: true }],

  // Bot sahibi
  ['owner_blacklist', { guild_id: 1 }, { unique: true }],
  ['owner_maintenance', { scope: 1, target: 1, guild_id: 1 }, { unique: true }],
  ['owner_announcements', { kind: 1, created_at: -1 }, {}],
  ['owner_audit', { at: -1 }, {}],
  ['owner_audit', { owner_id: 1, at: -1 }, {}],

  // Moderasyon
  ['punishments', { guild_id: 1, user_id: 1, active: 1 }, {}],
  ['punishments', { guild_id: 1, type: 1 }, {}],
  ['punishments', { guild_id: 1, expires_at: 1 }, {}],
  ['warnings', { guild_id: 1, user_id: 1 }, { unique: true }],
  ['ban_appeals', { guild_id: 1, status: 1 }, {}],
  ['role_logs', { guild_id: 1, user_id: 1, at: -1 }, {}],

  // Guard
  ['guard_safe', { guild_id: 1, target_id: 1 }, { unique: true }],
  ['guard_config', { guild_id: 1, module_key: 1 }, { unique: true }],
  ['guard_protected_roles', { guild_id: 1, role_id: 1 }, { unique: true }],
  ['guard_link_whitelist', { guild_id: 1, domain: 1 }, { unique: true }],
  ['guard_incidents', { guild_id: 1, at: -1 }, {}],
  ['guard_night_mode', { guild_id: 1 }, { unique: true }],

  // Backup
  ['backups', { guild_id: 1, kind: 1, created_at: -1 }, {}],
  ['message_backups', { guild_id: 1, channel_id: 1, message_id: 1 }, { unique: true }],

  // Ticket
  ['ticket_panels', { guild_id: 1, category_key: 1 }, { unique: true }],
  ['tickets', { guild_id: 1, channel_id: 1 }, { unique: true }],
  ['tickets', { guild_id: 1, opener_id: 1, status: 1 }, {}],
  ['ticket_members', { ticket_id: 1, user_id: 1 }, { unique: true }],
  ['ticket_events', { ticket_id: 1, at: -1 }, {}],
  ['ticket_transcripts', { ticket_id: 1 }, { unique: true }],

  // Ekip / Mesai
  ['teams', { guild_id: 1, name: 1 }, { unique: true }],
  ['team_members', { team_id: 1, user_id: 1 }, { unique: true }],
  ['shifts', { guild_id: 1, user_id: 1, started_at: -1 }, {}],
  ['shifts', { guild_id: 1, ended_at: 1 }, {}],
  ['shift_totals', { guild_id: 1, user_id: 1, period: 1 }, { unique: true }],
  ['shift_config', { guild_id: 1 }, { unique: true }],
  ['units', { guild_id: 1, name: 1 }, { unique: true }],
  ['unit_members', { unit_id: 1, user_id: 1 }, { unique: true }],
  ['excuses', { guild_id: 1, user_id: 1, status: 1 }, {}],
  ['inactivity_checks', { guild_id: 1, user_id: 1 }, { unique: true }],
  ['activity_tests', { guild_id: 1, message_id: 1 }, { unique: true }],

  // FiveM
  ['fivem_config', { guild_id: 1 }, { unique: true }],
  ['registrations', { guild_id: 1, user_id: 1, at: -1 }, {}],
  ['registration_counts', { guild_id: 1, user_id: 1 }, { unique: true }],
  ['whitelist', { guild_id: 1, user_id: 1 }, { unique: true }],
  ['formations', { guild_id: 1, name: 1 }, { unique: true }],
  ['support_queue', { guild_id: 1, status: 1 }, {}],
  ['interviews', { guild_id: 1, status: 1 }, {}],
  ['complaints', { guild_id: 1, status: 1 }, {}],
  ['feedbacks', { guild_id: 1, staff_id: 1, at: -1 }, {}],
  ['donations', { guild_id: 1, user_id: 1, at: -1 }, {}],
  ['meetings', { guild_id: 1, starts_at: 1 }, {}],
  ['events', { guild_id: 1, starts_at: 1 }, {}],
  ['giveaways', { guild_id: 1, ended: 1, ends_at: 1 }, {}],
  ['blacklist_servers', { guild_id: 1, blacklisted_guild_id: 1 }, { unique: true }],
  ['blacklist_users', { guild_id: 1, user_id: 1 }, { unique: true }],
  ['applications_forms', { guild_id: 1, key: 1 }, { unique: true }],
  ['applications_submissions', { guild_id: 1, form_key: 1, user_id: 1, status: 1 }, {}],
  ['private_rooms', { guild_id: 1, channel_id: 1 }, { unique: true }],
  ['support_logs', { guild_id: 1, staff_id: 1, at: -1 }, {}],

  // Ek yardimci koleksiyonlar
  ['command_usage', { guild_id: 1, command: 1, at: -1 }, {}],
  ['bot_errors', { code: 1 }, { unique: true }],
  ['bot_errors', { at: 1 }, { expireAfterSeconds: 30 * 24 * 3600 }], // TTL: 30 gun
  ['invites', { guild_id: 1, code: 1 }, { unique: true }],
  ['invite_uses', { guild_id: 1, user_id: 1, at: -1 }, {}],
  ['reaction_roles', { guild_id: 1, message_id: 1, emoji: 1 }, { unique: true }],
  ['guild_rules', { guild_id: 1 }, { unique: true }],
  ['polls', { guild_id: 1, message_id: 1 }, { unique: true }],
];

export default {
  name: '001_init',

  async up(db, logger) {
    // 1) Koleksiyonlari ac (idempotent)
    const existing = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name),
    );
    for (const name of COLLECTIONS) {
      if (!existing.has(name)) {
        await db.createCollection(name);
      }
    }

    // 2) Indeksleri kur (createIndex zaten idempotent)
    for (const [collection, keys, options] of INDEXES) {
      await db.collection(collection).createIndex(keys, options ?? {});
    }

    logger.info(
      { collections: COLLECTIONS.length, indexes: INDEXES.length },
      '001_init: koleksiyonlar ve indeksler hazir',
    );
  },

  async down(db, logger) {
    for (const name of COLLECTIONS) {
      try {
        await db.dropCollection(name);
      } catch {
        /* koleksiyon yoksa sorun degil */
      }
    }
    logger.warn({ collections: COLLECTIONS.length }, '001_init geri alindi: koleksiyonlar silindi');
  },
};
