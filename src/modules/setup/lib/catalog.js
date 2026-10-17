/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export const MAX_CHANNELS_PER_CATEGORY = 50;

/** Kurulum sema surumu (guild_settings: setup.version). */
export const SETUP_VERSION = 1;

/** Sihirbaz paketleri. */
export const PACKAGES = [
  { id: 'guard', name: 'Guard', emojiKey: 'GUARD' },
  { id: 'moderasyon', name: 'Moderasyon', emojiKey: 'BAN' },
  { id: 'fivem', name: 'FiveM', emojiKey: 'FIVEM' },
  { id: 'ticket', name: 'Ticket', emojiKey: 'TICKET' },
  { id: 'ekip_mesai', name: 'Ekip / Mesai', emojiKey: 'MESAI' },
  { id: 'basvuru', name: 'Başvuru', emojiKey: 'BASVURU' },
  { id: 'hepsi', name: 'Tümü', emojiKey: 'BASARI' },
];

/** Sihirbaz varsayilani: bot tipine uygun "Tümü". */
export const DEFAULT_PACKAGE = 'hepsi';

// ---------------------------------------------------------------------------
// Roller - yukaridan asagiya hiyerarsi sirasi
// ---------------------------------------------------------------------------

export const ROLES = [
  { key: 'yonetici', name: 'Yönetici', color: '#ED4245', hoist: true },
  { key: 'ust_yetkili', name: 'Üst Yetkili', color: '#EB459E', hoist: true },
  { key: 'moderator', name: 'Moderatör', color: '#9B59B6', hoist: true, package: 'moderasyon' },
  { key: 'ban_yetkilisi', name: 'Ban Yetkilisi', color: '#E67E22', package: 'moderasyon' },
  { key: 'yetkili', name: 'Yetkili', color: '#5865F2', hoist: true },
  { key: 'destek', name: 'Destek', color: '#1ABC9C', package: 'ticket' },
  { key: 'mulakatci', name: 'Mülakatçı', color: '#3498DB', package: 'fivem' },
  { key: 'kayit_yetkilisi', name: 'Kayıt Yetkilisi', color: '#2ECC71', package: 'fivem' },
  { key: 'whitelist', name: 'Whitelist', color: '#57F287', package: 'fivem' },
  { key: 'patron', name: 'Patron', color: '#F1C40F', package: 'ekip_mesai' },
  { key: 'boss', name: 'Boss', color: '#E91E63', package: 'ekip_mesai' },
  { key: 'legal_ekip', name: 'Legal Ekip', color: '#3B82F6', package: 'ekip_mesai' },
  { key: 'illegal_ekip', name: 'Illegal Ekip', color: '#992D22', package: 'ekip_mesai' },
  { key: 'guard_safe_1', name: 'Guard Safe 1', color: '#95A5A6', package: 'guard' },
  { key: 'guard_safe_2', name: 'Guard Safe 2', color: '#95A5A6', package: 'guard' },
  { key: 'guard_safe_3', name: 'Guard Safe 3', color: '#95A5A6', package: 'guard' },
  { key: 'guard_safe_4', name: 'Guard Safe 4', color: '#95A5A6', package: 'guard' },
  { key: 'mesai', name: 'Mesai', color: '#FEE75C', package: 'ekip_mesai' },
  { key: 'oto_rol', name: 'Oto Rol', color: '#99AAB5' },
  { key: 'kayitli', name: 'Kayıtlı', color: '#57F287', package: 'fivem' },
  { key: 'kayitsiz', name: 'Kayıtsız', color: '#99AAB5' },
  { key: 'etkinlik_yasagi', name: 'Etkinlik Yasağı', color: '#AAB0B5', package: 'moderasyon' },
  { key: 'arac_yasagi', name: 'Araç Yasağı', color: '#AAB0B5', package: 'moderasyon' },
  { key: 'susturulmus', name: 'Susturulmuş', color: '#818386', package: 'moderasyon' },
  { key: 'blacklist', name: 'Blacklist', color: '#2C2F33' },
];

// ---------------------------------------------------------------------------
// Izin overwrite yardimcilari
// ---------------------------------------------------------------------------

/** Yalnizca listedeki rollere gorunur + yazma hakki olan kanallar icin. */
function hiddenForEveryone(roles, { send = true } = {}) {
  const out = { everyone: { deny: ['ViewChannel'] } };
  const allow = ['ViewChannel'];
  if (send) allow.push('SendMessages', 'SendMessagesInThreads', 'ReadMessageHistory');
  for (const roleKey of roles) out[roleKey] = { allow: [...allow, 'AttachFiles', 'EmbedLinks'] };
  return out;
}

/** Herkes gorur, yalnizca personel yazar (duyuru/kurallar/panel kanallari). */
function staffWrite(roles = ['yonetici', 'ust_yetkili', 'yetkili', 'moderator']) {
  const out = { everyone: { deny: ['SendMessages', 'SendMessagesInThreads'] } };
  for (const roleKey of roles) {
    out[roleKey] = {
      allow: ['ViewChannel', 'SendMessages', 'SendMessagesInThreads', 'EmbedLinks', 'AttachFiles'],
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Kategoriler
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  { key: 'cat_bilgi', name: 'BİLGİ' },
  { key: 'cat_kayit', name: 'KAYIT' },
  { key: 'cat_destek', name: 'DESTEK' },
  {
    key: 'cat_yetkili',
    name: 'YETKİLİ',
    overwrites: hiddenForEveryone(['yetkili', 'ust_yetkili', 'yonetici', 'moderator', 'destek', 'ban_yetkilisi']),
  },
  {
    key: 'cat_ekipler',
    name: 'EKİPLER',
    overwrites: hiddenForEveryone(['legal_ekip', 'illegal_ekip', 'patron', 'boss', 'yonetici']),
  },
  {
    key: 'cat_log',
    name: 'LOG',
    hidden: true,
    overwrites: hiddenForEveryone(['yonetici', 'ust_yetkili']),
  },
  {
    key: 'cat_guard',
    name: 'GUARD',
    hidden: true,
    package: 'guard',
    overwrites: hiddenForEveryone(['yonetici', 'ust_yetkili']),
  },
];

// ---------------------------------------------------------------------------
// Kanallar - log kanallari LOG_CHANNELS icinde
// ---------------------------------------------------------------------------

export const CHANNELS = [
  // BİLGİ
  { key: 'kurallar', name: 'kurallar', category: 'cat_bilgi', type: 'text', overwrites: staffWrite() },
  { key: 'duyurular', name: 'duyurular', category: 'cat_bilgi', type: 'text', overwrites: staffWrite() },
  { key: 'guncellemeler', name: 'guncellemeler', category: 'cat_bilgi', type: 'text', overwrites: staffWrite() },
  { key: 'panel_durum', name: 'sunucu-durumu', category: 'cat_bilgi', type: 'text', package: 'fivem', overwrites: staffWrite(['yonetici', 'ust_yetkili']) },
  { key: 'oylama', name: 'oylama', category: 'cat_bilgi', type: 'text' },

  // ÖZEL ODA: oda olusturma paneli + join-to-create hub ses kanali
  { key: 'panel_oda', name: 'oda-panel', category: 'cat_bilgi', type: 'text', overwrites: staffWrite(['yonetici', 'ust_yetkili']) },
  { key: 'oda_hub', name: 'oda-olustur', category: 'cat_bilgi', type: 'voice' },

  // KAYIT (FiveM)
  { key: 'panel_kayit', name: 'kayıt-panel', category: 'cat_kayit', type: 'text', package: 'fivem', overwrites: staffWrite(['yonetici', 'ust_yetkili', 'kayit_yetkilisi']) },
  { key: 'panel_whitelist', name: 'whitelist-başvuru', category: 'cat_kayit', type: 'text', package: 'fivem' },
  { key: 'ic_isim_onay', name: 'ic-isim-onay', category: 'cat_kayit', type: 'text', package: 'fivem' },

  // DESTEK
  { key: 'destek_bekleme', name: 'destek-bekleme', category: 'cat_destek', type: 'voice', package: 'fivem' },
  { key: 'panel_ticket', name: 'ticket-panel', category: 'cat_destek', type: 'text', package: 'ticket', overwrites: staffWrite(['yonetici', 'ust_yetkili', 'destek']) },
  { key: 'panel_sikayet', name: 'şikayet-panel', category: 'cat_destek', type: 'text', package: 'fivem', overwrites: staffWrite(['yonetici', 'ust_yetkili']) },
  { key: 'ban_itiraz', name: 'ban-itiraz', category: 'cat_destek', type: 'text', package: 'fivem' },
  { key: 'mulakat_bekleme', name: 'mülakat-bekleme', category: 'cat_destek', type: 'voice', package: 'fivem' },

  // YETKİLİ
  { key: 'yetkili_sohbet', name: 'yetkili-sohbet', category: 'cat_yetkili', type: 'text' },
  { key: 'yetkili_komut', name: 'yetkili-komut', category: 'cat_yetkili', type: 'text' },
  { key: 'panel_mesai', name: 'mesai-panel', category: 'cat_yetkili', type: 'text', package: 'ekip_mesai', overwrites: staffWrite(['yonetici', 'ust_yetkili']) },
  { key: 'mesai_leaderboard', name: 'mesai-leaderboard', category: 'cat_yetkili', type: 'text', package: 'ekip_mesai', overwrites: staffWrite(['yonetici', 'ust_yetkili']) },
  { key: 'aktif_birimler', name: 'aktif-birimler', category: 'cat_yetkili', type: 'text', package: 'ekip_mesai', overwrites: staffWrite(['yonetici', 'ust_yetkili']) },
  { key: 'mazeret', name: 'mazeret', category: 'cat_yetkili', type: 'text', package: 'ekip_mesai' },
  { key: 'toplanti', name: 'toplantı', category: 'cat_yetkili', type: 'text', package: 'ekip_mesai', overwrites: staffWrite(['yonetici', 'ust_yetkili']) },
  { key: 'toplanti_ses', name: 'toplantı-ses', category: 'cat_yetkili', type: 'voice', package: 'ekip_mesai' },
  { key: 'etkinlik', name: 'etkinlik', category: 'cat_yetkili', type: 'text', package: 'ekip_mesai' },

  // EKİPLER
  { key: 'legal_ekipler', name: 'legal-ekipler', category: 'cat_ekipler', type: 'text', package: 'ekip_mesai' },
  { key: 'illegal_ekipler', name: 'illegal-ekipler', category: 'cat_ekipler', type: 'text', package: 'ekip_mesai' },
  { key: 'ekip_basvuru', name: 'ekip-başvuru', category: 'cat_ekipler', type: 'text', package: 'basvuru' },
];

// ---------------------------------------------------------------------------
// Log kanallari
// ---------------------------------------------------------------------------

export const LOG_CHANNELS = [
  // Sunucu
  { key: 'log_guild_update', name: 'guild-update', category: 'cat_log', type: 'text' },
  { key: 'log_url', name: 'url-log', category: 'cat_log', type: 'text' },
  { key: 'log_emoji', name: 'emoji-log', category: 'cat_log', type: 'text' },
  { key: 'log_sticker', name: 'sticker-log', category: 'cat_log', type: 'text' },
  { key: 'log_webhook', name: 'webhook-log', category: 'cat_log', type: 'text' },
  { key: 'log_integration', name: 'integration-log', category: 'cat_log', type: 'text' },

  // Kanal
  { key: 'log_kanal_olustur', name: 'kanal-olustur', category: 'cat_log', type: 'text' },
  { key: 'log_kanal_sil', name: 'kanal-sil', category: 'cat_log', type: 'text' },
  { key: 'log_kanal_guncelle', name: 'kanal-guncelle', category: 'cat_log', type: 'text' },
  { key: 'log_kategori', name: 'kategori-log', category: 'cat_log', type: 'text' },
  { key: 'log_izin', name: 'izin-log', category: 'cat_log', type: 'text' },

  // Rol
  { key: 'log_rol_olustur', name: 'rol-olustur', category: 'cat_log', type: 'text' },
  { key: 'log_rol_sil', name: 'rol-sil', category: 'cat_log', type: 'text' },
  { key: 'log_rol_guncelle', name: 'rol-guncelle', category: 'cat_log', type: 'text' },
  { key: 'log_rol_ver_al', name: 'rol-ver-al-log', category: 'cat_log', type: 'text' },
  { key: 'log_toplu_rol', name: 'toplu-rol-logs', category: 'cat_log', type: 'text' },

  // Üye
  { key: 'log_giris_cikis', name: 'giris-cikis', category: 'cat_log', type: 'text' },
  { key: 'log_davet', name: 'davet-log', category: 'cat_log', type: 'text' },
  { key: 'log_isim_degisiklik', name: 'isim-degisiklik', category: 'cat_log', type: 'text' },
  { key: 'log_ban', name: 'ban-log', category: 'cat_log', type: 'text', package: 'moderasyon' },
  { key: 'log_unban', name: 'unban-log', category: 'cat_log', type: 'text', package: 'moderasyon' },
  { key: 'log_kick', name: 'kick-log', category: 'cat_log', type: 'text', package: 'moderasyon' },
  { key: 'log_mute', name: 'mute-log', category: 'cat_log', type: 'text', package: 'moderasyon' },
  { key: 'log_uyari', name: 'uyari-log', category: 'cat_log', type: 'text', package: 'moderasyon' },

  // Mesaj
  { key: 'log_mesaj_silme', name: 'mesaj-silme', category: 'cat_log', type: 'text' },
  { key: 'log_mesaj_duzenleme', name: 'mesaj-duzenleme', category: 'cat_log', type: 'text' },
  { key: 'log_toplu_silme', name: 'toplu-silme', category: 'cat_log', type: 'text' },
  { key: 'log_snipe', name: 'snipe-cache', category: 'cat_log', type: 'text' },

  // Ses
  { key: 'log_ses_giris_cikis', name: 'ses-giris-cikis', category: 'cat_log', type: 'text' },
  { key: 'log_ses_tasima', name: 'ses-tasima', category: 'cat_log', type: 'text' },
  { key: 'log_mic_kulaklik', name: 'mic-kulaklik-log', category: 'cat_log', type: 'text' },

  // Moderasyon / FiveM
  { key: 'log_olusum_bilgi', name: 'olusum-bilgi-logs', category: 'cat_log', type: 'text', package: 'fivem' },
  { key: 'log_olusum_ban_unban', name: 'olusum-ban-unban-logs', category: 'cat_log', type: 'text', package: 'fivem' },
  { key: 'log_yetki_ver_al', name: 'yetki-ver-al-logs', category: 'cat_log', type: 'text', package: 'fivem' },
  { key: 'log_kayit', name: 'kayit-log', category: 'cat_log', type: 'text', package: 'fivem' },
  { key: 'log_whitelist', name: 'whitelist-log', category: 'cat_log', type: 'text', package: 'fivem' },
  { key: 'log_destek', name: 'destek-log', category: 'cat_log', type: 'text', package: 'fivem' },
  { key: 'log_destek_bekleme', name: 'destek-bekleme-log', category: 'cat_log', type: 'text', package: 'fivem' },
  { key: 'log_mulakat', name: 'mulakat-log', category: 'cat_log', type: 'text', package: 'fivem' },
  { key: 'log_donate', name: 'donate-log', category: 'cat_log', type: 'text', package: 'fivem' },
  { key: 'log_sikayet', name: 'sikayet-log', category: 'cat_log', type: 'text', package: 'fivem' },
  { key: 'log_ban_itiraz', name: 'ban-itiraz-log', category: 'cat_log', type: 'text', package: 'fivem' },
  { key: 'log_feedback', name: 'feedback-log', category: 'cat_log', type: 'text', package: 'fivem' },
  { key: 'log_cfx_wh', name: 'cfx-wh-log', category: 'cat_log', type: 'text', package: 'fivem' },
  { key: 'log_sorgu', name: 'sorgu-log', category: 'cat_log', type: 'text', package: 'fivem' },
  { key: 'log_blacklist', name: 'blacklist-log', category: 'cat_log', type: 'text', package: 'fivem' },

  // Ticket
  { key: 'log_ticket', name: 'ticket-log', category: 'cat_log', type: 'text', package: 'ticket' },
  { key: 'log_ticket_transcript', name: 'ticket-transcript', category: 'cat_log', type: 'text', package: 'ticket' },
  { key: 'log_ticket_puan', name: 'ticket-puan-log', category: 'cat_log', type: 'text', package: 'ticket' },

  // Mesai / Ekip
  { key: 'log_mesai', name: 'mesai-log', category: 'cat_log', type: 'text', package: 'ekip_mesai' },
  { key: 'log_mazeret', name: 'mazeret-log', category: 'cat_log', type: 'text', package: 'ekip_mesai' },
  { key: 'log_ekip', name: 'ekip-log', category: 'cat_log', type: 'text', package: 'ekip_mesai' },
  { key: 'log_birim', name: 'birim-log', category: 'cat_log', type: 'text', package: 'ekip_mesai' },
  { key: 'log_aktiflik', name: 'aktiflik-log', category: 'cat_log', type: 'text', package: 'ekip_mesai' },
  { key: 'log_toplanti', name: 'toplanti-log', category: 'cat_log', type: 'text', package: 'ekip_mesai' },
  { key: 'log_etkinlik', name: 'etkinlik-log', category: 'cat_log', type: 'text', package: 'ekip_mesai' },
  { key: 'log_basvuru', name: 'basvuru-log', category: 'cat_log', type: 'text', package: 'basvuru' },

  // Guard / Backup (gizli GUARD kategorisi)
  { key: 'log_guard', name: 'guard-log', category: 'cat_guard', type: 'text', package: 'guard' },
  { key: 'log_backup', name: 'backup-log', category: 'cat_guard', type: 'text', package: 'guard' },
  { key: 'log_guvenli_liste', name: 'guvenli-liste-log', category: 'cat_guard', type: 'text', package: 'guard' },
  { key: 'log_gece_modu', name: 'gece-modu-log', category: 'cat_guard', type: 'text', package: 'guard' },

  // Bot
  { key: 'log_bot_hata', name: 'bot-hata-log', category: 'cat_log', type: 'text' },
  { key: 'log_komut_kullanim', name: 'komut-kullanim-log', category: 'cat_log', type: 'text' },
];

// ---------------------------------------------------------------------------
// Sistemler - modul ustu ac/kapat katmani
// ---------------------------------------------------------------------------

export const SYSTEMS = [
  { id: 'guard', name: 'Guard (Koruma)', moduleId: 'guard', package: 'guard' },
  { id: 'backup', name: 'Backup', moduleId: 'backup', package: 'guard' },
  { id: 'moderasyon', name: 'Moderasyon', moduleId: 'moderation', package: 'moderasyon' },
  { id: 'ticket', name: 'Ticket', moduleId: 'ticket', package: 'ticket' },
  { id: 'kayit', name: 'Kayıt', moduleId: 'fivem', package: 'fivem' },
  { id: 'whitelist', name: 'Whitelist', moduleId: 'fivem', package: 'fivem' },
  { id: 'destek_bekleme', name: 'Destek Bekleme', moduleId: 'fivem', package: 'fivem' },
  { id: 'mulakat', name: 'Mülakat', moduleId: 'fivem', package: 'fivem' },
  { id: 'fivem_durum', name: 'FiveM Durum', moduleId: 'fivem', package: 'fivem' },
  { id: 'mesai', name: 'Mesai', moduleId: 'shift', package: 'ekip_mesai' },
  { id: 'birim', name: 'Birim', moduleId: 'shift', package: 'ekip_mesai' },
  { id: 'mazeret', name: 'Mazeret', moduleId: 'shift', package: 'ekip_mesai' },
  { id: 'aktiflik', name: 'Aktiflik Testi', moduleId: 'shift', package: 'ekip_mesai' },
  { id: 'ekip', name: 'Ekip', moduleId: 'team', package: 'ekip_mesai' },
  { id: 'etkinlik', name: 'Etkinlik', moduleId: 'event', package: 'ekip_mesai' },
  { id: 'toplanti', name: 'Toplantı', moduleId: 'event', package: 'ekip_mesai' },
  { id: 'cekilis', name: 'Çekiliş', moduleId: 'event', package: 'ekip_mesai' },
  { id: 'basvuru', name: 'Başvuru', moduleId: 'application', package: 'basvuru' },
  { id: 'blacklist', name: 'Blacklist', moduleId: 'blacklist', package: null },
  { id: 'ozel_oda', name: 'Özel Oda', moduleId: 'rooms', package: null },
  { id: 'loglar', name: 'Loglar', moduleId: 'logging', package: null },
  { id: 'dm_duyuru', name: 'DM Duyuru', moduleId: 'announce', package: null },
  { id: 'oto_rol', name: 'Oto Rol', moduleId: 'moderation', package: null },
  { id: 'hosgeldin', name: 'Hoş Geldin', moduleId: null, package: null },
  { id: 'duyuru', name: 'Duyurular', moduleId: 'duyuru', package: null },
  { id: 'sicil', name: 'Ceza ve Sicil', moduleId: 'sicil', package: null },
  { id: 'karar', name: 'Karar ve Oylama', moduleId: 'karar', package: null },
  { id: 'gorev', name: 'Görev ve Hedef', moduleId: 'gorev', package: 'ekip_mesai' },
  { id: 'ani', name: 'Anı Arşivi', moduleId: 'ani', package: null },
  { id: 'izin', name: 'İzin Dedektifi', moduleId: 'izin', package: null },
  { id: 'analitik', name: 'Analitik', moduleId: 'analitik', package: null },
  { id: 'yetkikontrol', name: 'Yetki Kontrol', moduleId: 'yetkikontrol', package: null },
];
