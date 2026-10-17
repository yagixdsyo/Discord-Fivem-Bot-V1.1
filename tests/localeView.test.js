/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createTranslator } from '../src/locales/index.js';
import { rulesSelectRow } from '../src/modules/fivem/commands/kurallar.js';
import {
  complaintCardPayload,
  complaintPanelPayload,
  donateInfoPayload,
  ekipInfoPayload,
  interviewCardPayload,
  nameRequestPayload,
  olusumPermCardPayload,
  pollPayload,
  rulesPayload,
  serverInfoPayload,
  supportCallPayload,
  supportPanelPayload,
  whitelistPayload,
} from '../src/modules/fivem/lib/view.js';
import { kayitInteractivePayload } from '../src/modules/fivem/lib/kayitFlow.js';

const t = createTranslator('tr');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, out);
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

describe('fivem yerellestirme kapsamasi', () => {
  it('statik t(...) anahtarlarinin tamami tr.json icinde tanimli', () => {
    const root = resolve(process.cwd(), 'src/modules');
    const files = [
      ...walk(join(root, 'fivem')),
      ...walk(join(root, 'announce')),
      ...walk(join(root, 'rooms')),
      ...walk(join(root, 'ticket')),
      ...walk(join(root, 'shift')),
      ...walk(join(root, 'team')),
      ...walk(join(root, 'event')),
      ...walk(join(root, 'application')),
      ...walk(join(root, 'blacklist')),
      ...walk(join(root, 'core')),
    ];

    const missing = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        const key = match[1];
        if (t(key) === key) missing.push(`${key} (${file.replace(root, '')})`);
      }
    }

    expect([...new Set(missing)]).toEqual([]);
  });

  it('dinamik anahtar aileleri tanimli', () => {
    const keys = [
      'fivem.destek.kind.genel',
      'fivem.destek.kind.mulakat',
      'fivem.ekip.types.legal',
      'fivem.ekip.types.illegal',
      'fivem.mulakat.status_label.beklemede',
      'fivem.mulakat.status_label.gecti',
      'fivem.mulakat.status_label.iptal',
      'fivem.sikayet.status_label.inceleniyor',
      'fivem.sikayet.status_label.reddedildi',
      'fivem.status.state.aktif',
      'fivem.status.state.bakim',
      'fivem.status.state.restart',
      'fivem.status.state.kapali',
      'fivem.kayit.error.generic',
      'fivem.kayit.error.kanal_yok',
      'fivem.kayit.error.blacklist',
      'fivem.kayit.error.zaten_kayitli',
      'fivem.kayit.error.hesap_yeni',
      'fivem.kayit.error.rol_yok',
      'fivem.kayit.error.bot_konum',
      'fivem.kayit.error.discord',
      'fivem.wh.error.rol_yok',
      'fivem.wh.error.bot_konum',
      'announce.sources.players',
      'announce.sources.staff',
      'announce.dm.title',
    ];
    const missing = keys.filter((key) => t(key) === key);
    expect(missing).toEqual([]);
  });
});

describe('fivem kart sozlesmeleri (customId)', () => {
  it('kayit paneli kayit:et / kayit:sifirla tasir', () => {
    const json = JSON.stringify(kayitInteractivePayload(t, { open: true }));
    expect(json).toContain('kayit:et');
    expect(json).toContain('kayit:sifirla');
  });

  it('whitelist karti ver/kaldir metinleri uretir', () => {
    const given = JSON.stringify(whitelistPayload(t, { action: 'ver', userId: 'u1', isim: 'Ali', actorId: 'a1' }));
    expect(given).toContain('Whitelist Verildi');
    expect(given).toContain('<@u1>');
    expect(given).toContain('Ali');

    const removed = JSON.stringify(whitelistPayload(t, { action: 'kaldir', userId: 'u1', actorId: 'a1' }));
    expect(removed).toContain('Whitelist Kaldırıldı');
  });

  it('isim karti icisim:onay / icisim:red tasir', () => {
    const json = JSON.stringify(
      nameRequestPayload(t, {
        doc: { request_id: 'req-1', user_id: 'u1', kind: 'ic', name: 'Yeni Isim', created_at: new Date().toISOString() },
        ownerId: 'o1',
      }),
    );
    expect(json).toContain('icisim:onay:req-1:o1');
    expect(json).toContain('icisim:red:req-1:o1');
    expect(json).toContain('Yeni Isim');
  });

  it('olusum izin karti olusumper:onay / olusumper:red tasir', () => {
    const json = JSON.stringify(
      olusumPermCardPayload(t, {
        doc: { perm_id: 'p-1', name: 'Olusum', user_id: 'u1', role_name: 'rol', note: 'not' },
        ownerId: 'o1',
      }),
    );
    expect(json).toContain('olusumper:onay:p-1:o1');
    expect(json).toContain('olusumper:red:p-1:o1');
  });

  it('destek cagri karti sahiplen/cek/kapat butonlarini tasir', () => {
    const json = JSON.stringify(supportCallPayload(t, { userId: 'u1', ownerId: 'o1' }));
    expect(json).toContain('destek:sahiplen:u1');
    expect(json).toContain('destek:cek:u1');
    expect(json).toContain('destek:kapat:u1');

    const wait = JSON.stringify(supportCallPayload(t, { userId: 'u1', kind: 'bekleme' }));
    expect(wait).toContain('destek bekliyor');
    expect(JSON.stringify(supportPanelPayload(t))).toContain('destek:cagir');
  });

  it('mulakat karti gecti/kaldi/ertele butonlarini tasir', () => {
    const json = JSON.stringify(
      interviewCardPayload(t, {
        doc: { interview_id: 'mul-1', user_id: 'u1', invited_by: 'y1', status: 'beklemede', created_at: new Date().toISOString() },
        ownerId: 'o1',
      }),
    );
    expect(json).toContain('mulakat:gecti:mul-1:o1');
    expect(json).toContain('mulakat:kaldi:mul-1:o1');
    expect(json).toContain('mulakat:ertele:mul-1:o1');
    expect(json).toContain('Beklemede');
  });

  it('sikayet paneli ve karti dogru idleri tasir', () => {
    expect(JSON.stringify(complaintPanelPayload(t))).toContain('sikayet:ac');

    const json = JSON.stringify(
      complaintCardPayload(t, {
        doc: {
          complaint_id: 'sc-1',
          user_id: 'u1',
          target: 'hedef',
          reason: 'kufur',
          evidence: null,
          status: 'beklemede',
          created_at: new Date().toISOString(),
        },
        ownerId: 'o1',
      }),
    );
    expect(json).toContain('sikayet:inceleniyor:sc-1:o1');
    expect(json).toContain('sikayet:sonuclandi:sc-1:o1');
    expect(json).toContain('sikayet:reddedildi:sc-1:o1');
  });

  it('oylama karti oylama:sec / oylama:kapat ve sonuclari tasir', () => {
    const results = [
      { index: 0, text: 'A', count: 2, percent: 67, bar: '▰▰▰▰▰▰▰▱▱▱' },
      { index: 1, text: 'B', count: 1, percent: 33, bar: '▰▰▰▱▱▱▱▱▱▱' },
    ];
    const open = JSON.stringify(
      pollPayload(t, {
        doc: { poll_id: 'oy-1', question: 'Hangi harita?', options: ['A', 'B'], ends_at: null },
        results,
        closed: false,
        ownerId: 'o1',
      }),
    );
    expect(open).toContain('oylama:kapat:oy-1:o1');
    expect(open).toContain('Hangi harita?');
    expect(open).toContain('Toplam oy');

    const closed = JSON.stringify(pollPayload(t, { doc: { poll_id: 'oy-1', question: 'Hangi harita?', options: ['A', 'B'] }, results, closed: true }));
    expect(closed).not.toContain('oylama:kapat');
    expect(closed).toContain('Kapalı');
  });

  it('kurallar karti kurallar:sayfa selectini ve footer sayfasini tasir', () => {
    const pages = [{ title: 'Genel', lines: ['Madde 1'] }];
    const json = JSON.stringify(rulesPayload(t, { pages, index: 0, selectRow: rulesSelectRow(t, pages) }));
    expect(json).toContain('kurallar:sayfa');
    expect(json).toContain('Sayfa 1/1');
  });

  it('ekip, donate ve sunucu bilgi kartlari yerellestirilmis alanlari tasir', async () => {
    const ekip = JSON.stringify(
      ekipInfoPayload(t, {
        team: { team_id: 'e-1', name: 'Ekip', type: 'illegal', role_id: 'r1', patron_id: 'p1', boss_ids: ['b1'], limit: 10, writing_locked: true },
        memberCount: 4,
      }),
    );
    expect(ekip).toContain('Illegal');
    expect(ekip).toContain('Kilitli');

    const donate = JSON.stringify(
      donateInfoPayload(t, { info: { intro: 'Destek ol', packages: [{ name: 'VIP', price: '100 TL', desc: 'ekstra' }], methods: ['IBAN'], contact: 'dm' } }),
    );
    expect(donate).toContain('VIP');
    expect(donate).toContain('IBAN');

    const info = await serverInfoPayload(t, { guild: { name: 'Sunucu' }, cfx: { code: null }, info: null, ip: '1.2.3.4', rulesChannel: 'c1' });
    const infoJson = JSON.stringify(info);
    expect(infoJson).toContain('Sunucu');
    expect(infoJson).toContain('Kuralları okuyun');
    expect(info.files).toHaveLength(1); // canvas sunucu karti eki
  });
});
