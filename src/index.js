/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { bootstrap } from './core/bootstrap.js';

/**
 * Giris noktasi.
 * Baslatma hatalari (ornegin eksik .env) net Turkce mesajla konsola yazilir ve
 * surec 1 koduyla kapanir; calisma zamani hatalari errorHandler'a aittir (asla cokertmez).
 */
bootstrap().catch((err) => {
  if (err?.name === 'EnvValidationError') {
    console.error('\n[BASLATMA DURDURULDU] Ortam dosyasi eksik/hatali:\n');
    console.error(err.message);
    console.error('\nIpucu: .env.example dosyasini .env olarak kopyalayip doldurun.\n');
  } else {
    console.error('\n[BASLATMA DURDURULDU]', err?.stack ?? err?.message ?? err, '\n');
  }
  process.exit(1);
});
