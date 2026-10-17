
# Xqeria Dev V1.1 — FiveM Discord Yönetim Botu

> **Yapımcı: Xqeria** · **Discord: [discord.gg/bdfd](https://discord.gg/bdfd)**

Çok modüllü, üretim kalitesinde Discord yönetim botu. **Discord.js 14.27.0** ve
**Components V2** üzerine kuruludur; 26 modül ve 240'tan fazla komut içerir.
Tüm arayüz bileşenleri V2 kart/şablon katmanından geçer ve her kartın alt bilgisinde
`Xqeria Dev V1.1` imzası bulunur. Sabit emoji kullanılmaz; tüm emojiler `.env`
üzerinden yönetilir.

---

## İçindekiler

- [Özellikler](#özellikler)
- [Gereksinimler](#gereksinimler)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Komut Sistemi](#komut-sistemi)
- [Proje Yapısı](#proje-yapısı)
- [Güvenlik Notları](#güvenlik-notları)
- [Test](#test)
- [Lisans ve İletişim](#lisans-ve-i̇letişim)

---

## Özellikler

- **Kurulum Sihirbazı** — `/sistemkur` ile kategoriler, kanallar, roller ve paneller
  tek seferde kurulur; `/sistem-sil` ile kanal/kategori/roller tamamen sıfırlanır
  (owner log kanalı ve komutun çalıştığı kanal korunur).
- **Log Sistemi** — 60+ log kanalı, V2 kartları, toplu gönderim (batch), kanal
  bazlı emoji/accent paleti ve `/sil` transcript desteği (dosya + SourceBin).
- **Guard** — anti-raid koruması, öğrenme modu (24 saat), olay kaydı, yedekleme
  ve geri yükleme.
- **Moderasyon** — ban / kick / mute / uyarı / whitelist / blacklist, ceza sicili,
  botu konuşturma ve DM moderation kuyruğu.
- **FiveM** — canlı durum paneli (canvas), CFX + whitelist webhook (HMAC imzalı),
  kayıt sistemi, ekip yönetimi (patron/boss), mesai takibi (sesli mesai rolleri,
  leaderboard), terfi merdiveni ve donate sistemi.
- **Ticket** — kategori bazlı ticket panelleri, sahiplenme, transcript ve puanlama.
- **Başvuru** — yetkili / whitelist / legal / illegal başvuru formları ve
  DM röportaj akışı.
- **Özel Odalar** — join-to-create hub, kişi ekle/çıkar/yasak, canlı oda paneli
  ve sahip çıkınca oda silme seçeneği.
- **Etkinlik / Toplantı / Çekiliş**, duyuru sistemi, analitik raporları ve
  opsiyonel AI komutları (NVIDIA API anahtarı tanımlanırsa).
- **Backup** — otomatik periyodik yedek, manuel yedek/geri yükleme komutları.

## Gereksinimler

| Bileşen | Sürüm | Not |
| --- | --- | --- |
| Node.js | 20.0.0+ | Test edilen: güncel LTS |
| MongoDB | 6+ | Zorunlu (docker-compose hazır) |
| Redis | 6+ | Opsiyonel — yoksa cache/cooldown katmanı devre dışı kalır |
| Docker | — | Opsiyonel ama önerilir |

## Kurulum

```bash
# 1) Depoyu klonlayin
git clone <repo-url>
cd fivem

# 2) Bagimliliklari kurun
npm ci

# 3) Ornek ortam dosyasini kopyalayip doldurun
cp .env.example .env
#   - En az bir BOT_*_TOKEN girin (BOT_TOKEN tek bot icin yeterlidir)
#   - MONGO_URI / MONGO_DB_NAME / REDIS_URL
#   - OWNER_IDS (bot sahipleriin Discord ID'leri)
#   - Gelistirme icin DEV_GUILD_ID (slash komutlari aninda yenilenir)
#   - EMOJI_* degerleri (guild emoji ID'leri veya <:isim:id> etiketleri)

# 4) MongoDB + Redis'i baslatin (Docker ile)
docker compose up -d mongodb redis

# 5) Veritabani migrasyonlarini uygulayin
npm run migrate

# 6) Botu baslatin
npm start
```

Docker kullanmiyorsaniz (yerel gelistirme icin bellek ici MongoDB):

```powershell
npm run dev:mongo
$env:MONGO_URI='mongodb://127.0.0.1:27017/fivem_bot'; npm start
```

Bot basladiktan sonra sunucunuzda `/sistemkur` komutunu calistirin ve sihirbazi
takip edin. Kurulum tamamlandiginda paneller, log kanallari ve roller otomatik
olarak olusturulur.

## Ortam Değişkenleri

Örnek dosya: [`.env.example`](.env.example) — `.env` **asla** Git'e commit edilmez.

| Değişken | Açıklama |
| --- | --- |
| `BOT_TOKEN` | Tek bot ile çalıştırmak için ana token (çok botlu kurulumda `BOT_*_TOKEN` çeşitleri) |
| `MONGO_URI` / `MONGO_DB_NAME` | MongoDB bağlantısı |
| `REDIS_URL` | Redis bağlantısı (opsiyonel) |
| `OWNER_IDS` | Bot sahibi Discord ID'leri (virgülle ayrılır) |
| `DEV_GUILD_ID` | Geliştirme sunucusu — slash komutları anında yenilenir |
| `EMOJI_SOURCE` / `EMOJI_GUILD_ID` / `EMOJI_<ANAHTAR>` | Emoji sistemi; kodda sabit emoji yasaktır |
| `OWNER_LOG_GUILD_ID` / `OWNER_LOG_CHANNEL_ID` | Owner log kanalı (hata kodları, audit kartları) |
| `FIVEM_CFX_CODE` / `FIVEM_IP` | FiveM panel varsayılanları |
| `FIVEM_WH_PORT` | CFX/WH webhook portu (HMAC imzalı) |
| `HEALTH_PORT` | `/health` sağlık ucu portu |
| `NVIDIA_API_KEY` | Opsiyonel — tanımlıysa AI komutları etkinleşir |
| `SITE_API_BASE_URL` / `SITE_API_TOKEN` | Opsiyonel — legal site entegrasyonu |

## Komut Sistemi

- **Prefix** (varsayılan `.`) ve **slash** komutları aynı kod tabanından çalışır.
- Slash komutları global + guild kapsamına dağıtılır (`MODULE_PRIORITY` ile öncelikli
  modüller slash'a alınır); kalan komutlar prefix ile kullanılır.
- Tüm yanıtlar Components V2'dir (container + text display + buton/select).
- İlgili modül komutları: `/sistemkur`, `/sistem-sil`, `/oda-kur`, `/mesai-rol`,
  `/yetkili*`, `/kayit-rol`, `/backup-al` ve daha fazlası.

## Proje Yapısı

```
src/core        cekirdek (env dogrulama, logger, loader, komut dagitici, hata kodlari)
src/db          MongoDB katmani + migrasyonlar
src/modules     26 modul: komutlar + is mantigi (guard, logging, moderasyon, fivem...)
src/ui          Components V2 kurucu, sablonlar, limits dogrulayici, canvas kartlari
src/locales     yerellestirme (tr.json)
src/web         legal-site API koprusu + OpenAPI sozlesmesi
tests           Vitest test paketi
docs            kurulum kilavuzu
```

## Güvenlik Notları

- `.env` hiçbir zaman Git'e commit edilmez; sadece `.env.example` paylaşılır.
- Token, DB ve Redis bilgileri loglara yazılmaz.
- Guard modülü varsayılanda "öğrenme modu" (24 saat) ile açılır.
- Tüm komut girdileri zod ile doğrulanır; webhook uçları HMAC + timestamp ile korunur.
- V2 bileşenlerindeki buton/modal sahiplik kontrolleri her tıklamada yeniden doğrulanır.

## Test

```bash
npm test           # tum Vitest paketi
npm run test:watch # izleme modu
```

## Lisans ve İletişim

Bu proje **Xqeria** tarafından geliştirilmiştir. Tüm hakları saklıdır.
Kullanım koşulları için [`LICENSE`](LICENSE) dosyasına bakın: kendi sunucunuzda
kullanabilir ve uyarlayabilirsiniz; yeniden yayınlayamaz, satamaz veya yazarlık
iddia edemezsiniz.

- **Geliştirici:** Xqeria
- **Discord:** [discord.gg/bdfd](https://discord.gg/bdfd)
- **Sürüm imzası:** `Xqeria Dev V1.1`

- ## Görüntüler

- - **Yetki Terfi**
<img width="671" height="475" alt="yetkiterfi" src="https://github.com/user-attachments/assets/7decc7dd-c84f-4f95-a74f-bfeb08374a72" />

- **Yardım Menü**
<img width="431" height="314" alt="yardım" src="https://github.com/user-attachments/assets/65a837d0-80a1-427f-a98b-0f54ba7324eb" />

- **Ticket Panwl**
<img width="362" height="400" alt="ticket" src="https://github.com/user-attachments/assets/fba607ba-e480-4252-a4cc-cc9a71dc9136" />

- **Özel Oda Panel**
<img width="422" height="481" alt="özeloda" src="https://github.com/user-attachments/assets/140a22a5-5216-49aa-af8c-b89a3467f395" />

- **Örnek Log**
<img width="332" height="285" alt="log" src="https://github.com/user-attachments/assets/3a5ad6de-0d87-430a-b7bf-83b12fb2bc18" />

- **Kurulum Paneli**
<img width="668" height="407" alt="kruulum" src="https://github.com/user-attachments/assets/a406a60c-e28c-4371-82a7-63bf26f290f0" />

- **Kayıt Paneli**
<img width="449" height="285" alt="kayıt" src="https://github.com/user-attachments/assets/a98c68a9-1fb7-4edf-a95d-7b79818fb4dc" />

- **Guard Paneli**
<img width="547" height="485" alt="guard" src="https://github.com/user-attachments/assets/dd69f8ef-ff37-4483-baba-380a091686aa" />
