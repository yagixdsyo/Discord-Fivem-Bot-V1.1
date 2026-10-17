/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export const EMOJI_GROUPS = Object.freeze({
  genel: Object.freeze([
    'BASARI',
    'HATA',
    'UYARI',
    'BILGI',
    'YUKLENIYOR',
    'ONAY',
    'RED',
    'BEKLE',
    'KILIT',
    'KILIT_ACIK',
    'AYAR',
    'SAAT',
    'TAKVIM',
    'KULLANICI',
    'KULLANICILAR',
    'ROL',
    'KANAL',
    'SES',
    'SES_KAPALI',
    'MIC_ACIK',
    'MIC_KAPALI',
    'KULAKLIK_ACIK',
    'KULAKLIK_KAPALI',
    'TAC',
    'YILDIZ',
    'YILDIZ_BOS',
    'OK_SAG',
    'OK_SOL',
    'OK_ILK',
    'OK_SON',
    'SIL',
    'DUZENLE',
    'EKLE',
    'CIKAR',
    'YENILE',
    'KOPYALA',
    'LINK',
    'DOSYA',
    'NOT',
    'BELGE',
    'BAYRAK',
    'ZIL',
    'ARAMA',
    'FILTRE',
    'GRAFIK',
    'ID',
    'HOSGELDIN',
    'TOPLU',
  ]),
  durum: Object.freeze([
    'DURUM_AKTIF',
    'DURUM_BAKIM',
    'DURUM_RESTART',
    'DURUM_KAPALI',
    'KAYIT_ACIK',
    'KAYIT_KAPALI',
    'CEVRIMICI',
    'BOSTA',
    'RAHATSIZ_ETME',
    'CEVRIMDISI',
  ]),
  guard: Object.freeze([
    'GUARD',
    'KALKAN',
    'GUVENLI',
    'BACKUP',
    'GECE_MODU',
    'RAID',
    'SALDIRI',
    'GERI_AL',
    'YASAK',
  ]),
  moderasyon: Object.freeze([
    'BAN',
    'UNBAN',
    'PERMABAN',
    'KICK',
    'MUTE',
    'UNMUTE',
    'UYARI_VER',
    'WHITELIST',
    'BLACKLIST',
    'ROL_VER',
    'ROL_AL',
    'CEZA',
  ]),
  fivem: Object.freeze([
    'FIVEM',
    'CFX',
    'OLUSUM',
    'EKIP',
    'PATRON',
    'BOSS',
    'MULAKAT',
    'DESTEK',
    'DONATE',
    'SIKAYET',
    'KAYIT',
    'IC_ISIM',
    'OOC_ISIM',
    'DM',
    'DUYURU',
    'ODA',
  ]),
  eglence: Object.freeze([
    'OYUN',
    'ZAR',
    'SLOT',
    'YAZI_TURA',
    'TRIVIA',
  ]),
  ticket: Object.freeze([
    'TICKET',
    'TICKET_SAHIPLEN',
    'TICKET_KAPAT',
    'TICKET_GERI_AC',
    'UYE_EKLE',
    'UYE_CIKAR',
    'TRANSCRIPT',
    'PUAN',
  ]),
  mesai: Object.freeze([
    'MESAI',
    'MESAI_GIR',
    'MESAI_CIK',
    'LEADERBOARD',
    'BIRIM',
    'MAZERET',
    'INAKTIF',
    'AKTIF_SES',
    'TOPLANTI',
    'ETKINLIK',
    'CEKILIS',
    'BASVURU',
  ]),
  kanal: Object.freeze([
    'KANAL_AYRAC',
    'KANAL_LOG',
    'KANAL_PANEL',
    'KANAL_SES',
    'KANAL_EKIP',
  ]),
  yetkili: Object.freeze([
    'TERFI',
    'BAR_BAS_DOLU',
    'BAR_BAS_BOS',
    'BAR_ORTA_DOLU',
    'BAR_ORTA_BOS',
    'BAR_SON_DOLU',
    'BAR_SON_BOS',
  ]),
});

/**
 * Varsayilan olarak animasyonlu kabul edilen anahtarlar.
 * .env'de EMOJI_<KEY>_ANIM=false yazilarak kapatilabilir.
 */
export const ANIMATED_BY_DEFAULT = Object.freeze(['YUKLENIYOR']);

/** Tum emoji anahtarlari (duz liste). */
export const EMOJI_KEYS = Object.freeze(Object.values(EMOJI_GROUPS).flat());

/** Anahtar adini .env degisken adina cevirir: basari -> EMOJI_BASARI */
export function emojiEnvKey(key) {
  return `EMOJI_${String(key).toUpperCase()}`;
}

/** Anahtarin animasyon .env degisken adi: basari -> EMOJI_BASARI_ANIM */
export function emojiAnimEnvKey(key) {
  return `${emojiEnvKey(key)}_ANIM`;
}
