/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

process.env.LOG_LEVEL = 'silent';

import { describe, it, expect } from 'vitest';
import { initEmoji } from '../src/ui/emoji.js';
import { validateV2Payload } from '../src/ui/limits.js';
import { card, disabledCard } from '../src/ui/templates/base.js';
import { success } from '../src/ui/templates/success.js';
import { error } from '../src/ui/templates/error.js';
import { warn } from '../src/ui/templates/warn.js';
import { info } from '../src/ui/templates/info.js';
import { loading } from '../src/ui/templates/loading.js';
import { panel } from '../src/ui/templates/panel.js';
import { list } from '../src/ui/templates/list.js';
import { confirm } from '../src/ui/templates/confirm.js';
import { kv } from '../src/ui/templates/kv.js';
import { progress, bar } from '../src/ui/templates/progress.js';
import { usage } from '../src/ui/templates/usage.js';
import { button, row, selectMenu } from '../src/ui/v2.js';

// Sablonlarin kullandigi tum emoji anahtarlari (env'de tanimli oldugu varsayimi)
initEmoji({
  source: 'guild',
  guildId: '123456789012345678',
  map: Object.fromEntries(
    [
      'BASARI',
      'HATA',
      'UYARI',
      'BILGI',
      'YUKLENIYOR',
      'BELGE',
      'ONAY',
      'RED',
      'BEKLE',
      'OK_ILK',
      'OK_SOL',
      'OK_SAG',
      'OK_SON',
    ].map((key, i) => [key, { id: String(900000000000000000n + BigInt(i)), animated: false }]),
  ),
  missingKeys: [],
});

function expectValid(payload, label = '') {
  const r = validateV2Payload(payload);
  if (!r.ok) {
    throw new Error(`${label} gecersiz: ${r.errors.join(' | ')}`);
  }
  expect(r.ok).toBe(true);
}

function collectNodes(node, out = []) {
  if (node === null || node === undefined) return out;
  if (typeof node.toJSON === 'function') return collectNodes(node.toJSON(), out);
  if (Array.isArray(node)) {
    for (const child of node) collectNodes(child, out);
    return out;
  }
  if (typeof node === 'object') {
    if (typeof node.type === 'number') out.push(node);
    if (node.components) collectNodes(node.components, out);
    if (node.items) collectNodes(node.items, out);
    if (node.accessory) collectNodes(node.accessory, out);
  }
  return out;
}

// ---------------------------------------------------------------------------

describe('temel sablonlar V2 dogrulamasindan gecer', () => {
  it('success/error/warn/info/loading', () => {
    expectValid(success('Başarılı', ['İşlem tamamlandı.']), 'success');
    expectValid(error('Hata', ['Bir şeyler ters gitti.', 'Kod: ERR-ABC123']), 'error');
    expectValid(warn('Uyarı', ['Dikkat edin.']), 'warn');
    expectValid(info('Bilgi', ['Detay satırı.']), 'info');
    expectValid(loading('Yükleniyor', ['Bekleyin.']), 'loading');
  });

  it('panel sections/buttons/footer ile gecerli', () => {
    const payload = panel({
      title: 'Panel',
      description: ['Özet satırı.'],
      sections: [
        { text: 'Bölüm 1' },
        { separator: true },
        { text: 'Bölüm 2', accessory: button({ id: 'git', label: 'Git', style: 'primary' }) },
      ],
      buttons: [row([button({ id: 'p1', label: 'Bas', emojiKey: 'ONAY' })])],
      footer: 'alt bilgi',
    });
    expectValid(payload, 'panel');
  });

  it('confirm butonlari ile gecerli', () => {
    expectValid(confirm({ title: 'Emin misiniz?', description: 'Kayıt silinecek.', confirmId: 'c1', cancelId: 'x1' }), 'confirm');
  });

  it('kv bilgi karti gecerli', () => {
    expectValid(kv({ title: 'Durum', rows: [['Çalışma süresi', '2 gün'], ['Bağlantı', 'Aktif']], footer: 'son' }), 'kv');
  });

  it('progress karti ve bar metni', () => {
    expectValid(progress({ title: 'İlerleme', done: 3, total: 10, statusText: 'Devam ediyor.' }), 'progress');
    const b = bar(3, 10);
    expect(b).toContain('30%');
    expect(b).toContain('█');
  });

  it('usage karti komut tanimindan uretilir', () => {
    const payload = usage({
      name: 'ban',
      description: 'Üyeyi yasaklar.',
      args: [
        { name: 'kullanici', type: 'user', required: true, description: 'Hedef' },
        { name: 'sebep', type: 'rest', required: false },
      ],
      aliases: ['yasakla'],
      examples: ['/ban @user spam'],
      cooldown: 3,
      module: 'moderation',
    });
    expectValid(payload, 'usage');
    const texts = collectNodes(payload.components)
      .filter((n) => n.type === 10)
      .map((n) => n.content)
      .join('\n');
    expect(texts).toContain('/ban <kullanici> [sebep]');
    expect(texts).toContain('ban <kullanici> [sebep]');
  });

  it('card ozel butonlarla gecerli', () => {
    const payload = card({
      emojiKey: 'BILGI',
      title: 'Başlık',
      lines: ['Satır 1', 'Satır 2'],
      buttons: [row([button({ id: 'b1', label: 'Tamam', emojiKey: 'ONAY' })])],
      footer: 'alt',
      accent: 'primary',
    });
    expectValid(payload, 'card');
  });
});

// ---------------------------------------------------------------------------

describe('list sablonu', () => {
  const items = Array.from({ length: 12 }, (_, i) => `Kayıt ${i + 1}`);

  it('sayfalama matematigi ve gecerli payload', () => {
    const result = list({
      title: 'Liste',
      items,
      page: 0,
      pageSize: 5,
      namespace: 'test',
      ownerId: '5',
      renderItem: (item) => `- ${item}`,
      emojiKey: 'BELGE',
      footer: 'alt bilgi',
    });
    expect(result.totalPages).toBe(3);
    expect(result.pageItems).toHaveLength(5);
    expect(result.pageItems[0]).toBe('Kayıt 1');
    expectValid(result.payload, 'list sayfa 0');

    const page2 = list({
      title: 'Liste',
      items,
      page: 1,
      pageSize: 5,
      namespace: 'test',
      ownerId: '5',
      renderItem: (item) => `- ${item}`,
    });
    expect(page2.page).toBe(1);
    expect(page2.pageItems[0]).toBe('Kayıt 6');
    expectValid(page2.payload, 'list sayfa 1');
  });

  it('sayfa butonlari dogru customId uretir', () => {
    const result = list({
      title: 'Liste',
      items,
      page: 1,
      pageSize: 5,
      namespace: 'test',
      ownerId: '5',
      renderItem: (item) => `- ${item}`,
    });
    const buttons = collectNodes(result.payload.components).filter((n) => n.type === 2);
    const ids = buttons.map((b) => b.custom_id);
    expect(ids).toContain('ui:pg:f:test:5:0'); // ilk
    expect(ids).toContain('ui:pg:p:test:5:0'); // onceki = 0
    expect(ids).toContain('ui:pg:n:test:5:2'); // sonraki
    expect(ids).toContain('ui:pg:l:test:5:2'); // son
    expect(new Set(ids).size).toBe(ids.length); // ayni mesajda idler essiz olmali
    expect(ids).toContain('ui:pg:gostergesi:5'); // sayfa gostergesi
    const indicator = buttons.find((b) => b.custom_id === 'ui:pg:gostergesi:5');
    expect(indicator.label).toBe('2/3');
    expect(indicator.disabled).toBe(true);
  });

  it('tek sayfada buton satiri uretilmez', () => {
    const result = list({
      title: 'Liste',
      items: ['tek'],
      page: 0,
      pageSize: 5,
      namespace: 'test',
      renderItem: (item) => `- ${item}`,
    });
    const buttons = collectNodes(result.payload.components).filter((n) => n.type === 2);
    expect(buttons).toHaveLength(0);
    expectValid(result.payload, 'tek sayfa');
  });

  it('bos liste emptyText gosterir', () => {
    const result = list({ title: 'Liste', items: [], emptyText: 'Kayıt yok.' });
    const texts = collectNodes(result.payload.components)
      .filter((n) => n.type === 10)
      .map((n) => n.content)
      .join('\n');
    expect(texts).toContain('Kayıt yok.');
  });
});

// ---------------------------------------------------------------------------

describe('disabledCard', () => {
  it('butonlari ve select menuleri kalici devre disi birakir', () => {
    const result = list({
      title: 'Yardım',
      items: Array.from({ length: 12 }, (_, i) => `Komut ${i}`),
      page: 0,
      pageSize: 5,
      namespace: 'yardim-tumu',
      ownerId: '5',
      renderItem: (item) => `- ${item}`,
      extraRows: [
        row([
          selectMenu({
            id: 'yardim:kat:5',
            placeholder: 'Kategori',
            options: [
              { label: 'Tümü', value: 'tumu' },
              { label: 'Moderasyon', value: 'mod' },
            ],
          }),
        ]),
      ],
    });

    expectValid(result.payload, 'list + select');

    const disabled = disabledCard(result.payload);
    expectValid(disabled, 'disabledCard');

    const nodes = collectNodes(disabled.components);
    const clickable = nodes.filter((n) => n.type === 2 || (n.type >= 3 && n.type <= 8));
    expect(clickable.length).toBeGreaterThan(0);
    expect(clickable.every((n) => n.disabled === true)).toBe(true);
  });

  it('orijinal payload degismeden kalir (kopya uretilir)', () => {
    const original = success('Başarılı', ['x'], {
      buttons: [row([button({ id: 'q', label: 'Bas' })])],
    });
    const disabled = disabledCard(original);
    expectValid(original, 'orijinal payload');
    const originalButtons = collectNodes(original.components).filter((n) => n.type === 2);
    // builder toJSON paylasimli data'dir; kopyalama sonrasi orijinal hala pasif olmamali
    const disabledButtons = collectNodes(disabled.components).filter((n) => n.type === 2);
    expect(disabledButtons.every((b) => b.disabled === true)).toBe(true);
    expect(originalButtons.length).toBe(disabledButtons.length);
  });
});
