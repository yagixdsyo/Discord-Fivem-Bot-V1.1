# Kurulum Kilavuzu — Xqeria Dev V1.1

> Xqeria Dev V1.1 · discord.gg/bdfd

1. Node.js 20+ ve Docker Desktop kurun.
2. `.env.example` dosyasini `.env` olarak kopyalayip doldurun:
   - En az bir `BOT_*_TOKEN`
   - `MONGO_URI`, `MONGO_DB_NAME`, `REDIS_URL`
   - `OWNER_IDS`
   - Guild emojis için `EMOJI_<anahtar>` degerleri (eksik anahtar botu durdurmaz; uyarı verir)
3. Veritabanı ve Redis'i calistirin (Docker Compose/Podman vb.).
4. Migrasyonlari uygulayin: `npm run migrate`
5. Botu calistirin: `npm start`
6. Bot sahibi/sistem yöneticisi kanalında `/sistemkur` calistirin ve kanal/log rol eslestirmelerini tamamlayin.

## Upscale / Restart

- PM2/Docker restart politikalarina `restart: unless-stopped` kullanin.
- Backup alin: `/backup-al`; geri yükleme için `/backup-kur`.
- Guard learned mode sure bitince sunucu sahibi onayi ile sertlestirin.

---

Xqeria Dev V1.1 · [discord.gg/bdfd](https://discord.gg/bdfd)
