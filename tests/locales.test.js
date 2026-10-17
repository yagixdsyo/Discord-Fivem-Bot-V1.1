/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

process.env.LOG_LEVEL = 'silent'; // eksik anahtar uyarilari test ciktisini kirletmesin

import { describe, it, expect } from 'vitest';
import { t, createTranslator, DEFAULT_LANG } from '../src/locales/index.js';

describe('locale', () => {
  it('varsayilan dil tr', () => {
    expect(DEFAULT_LANG).toBe('tr');
  });

  it('bilinen anahtar Turkce metin doner', () => {
    expect(t('tr', 'help.title')).toBe('Yardım');
    expect(t('tr', 'ping.title')).toBe('Ping');
  });

  it('{degisken} interpolasyonu yapilir', () => {
    expect(t('tr', 'common.total_items', { adet: 5 })).toBe('Toplam 5 kayıt');
  });

  it('verilmeyen degisken yer tutucu olarak kalir', () => {
    expect(t('tr', 'common.total_items')).toBe('Toplam {adet} kayıt');
  });

  it('bilinmeyen anahtar anahtar adini doner (bot durmaz)', () => {
    expect(t('tr', 'yok.boyle.bir.anahtar')).toBe('yok.boyle.bir.anahtar');
  });

  it('desteklenmeyen dil varsayilan dile duser', () => {
    expect(t('xx', 'help.title')).toBe('Yardım');
  });

  it('nesne anahtarlari oldugu gibi doner', () => {
    const helpSection = t('tr', 'help');
    expect(typeof helpSection).toBe('object');
    expect(helpSection.title).toBe('Yardım');
  });

  it('createTranslator dile bagli calisan fonksiyon uretir', () => {
    const tr = createTranslator('tr');
    expect(tr('help.title')).toBe('Yardım');
    expect(tr('common.total_items', { adet: 2 })).toBe('Toplam 2 kayıt');
  });
});
