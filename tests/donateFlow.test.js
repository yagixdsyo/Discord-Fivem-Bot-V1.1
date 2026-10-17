/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import { createTranslator } from '../src/locales/index.js';

const t = createTranslator('tr');

describe('donate sayfalari', () => {
  it('6 sayfa uretir ve yerellestirilmis basliklar tasir', async () => {
    const { buildDonatePages } = await import('../src/modules/fivem/lib/donatePages.js');
    const pages = buildDonatePages(t, {
      info: {
        intro: 'Destek ol',
        packages: [{ name: 'VIP', price: '100 TL', desc: 'ekstra' }],
        methods: ['IBAN', 'Papara'],
        contact: 'dm',
      },
      donates: [{ donate_id: 'd-1', user_id: 'u1', user_tag: 'Ali', package: 'VIP', amount: '100 TL', created_at: new Date().toISOString() }],
    });

    expect(pages).toHaveLength(6);
    const titles = pages.map((page) => page.cardTitle);
    expect(titles[0]).toContain('Genel Bakış');
    expect(titles[1]).toContain('Paket');
    expect(titles[2]).toContain('Ödeme');
    expect(titles[3]).toContain('Son Donate');
    expect(titles[4]).toContain('Kural');
    expect(titles[5]).toContain('İletişim');

    // Son donateler sayfasi kaydi tasir
    const recent = pages[3];
    expect(recent.canvas.rows[0].title).toBe('VIP');
    expect(recent.canvas.rows[0].subtitle).toContain('Ali');
    expect(recent.canvas.rows[0].value).toBe('100 TL');
    // Paket sayfasi fiyat tasir
    expect(pages[1].canvas.rows[0].value).toBe('100 TL');
  });

  it('donate kaydi yokken de 6 sayfa uretir (bos durum)', async () => {
    const { buildDonatePages } = await import('../src/modules/fivem/lib/donatePages.js');
    const pages = buildDonatePages(t, { info: null, donates: [] });
    expect(pages).toHaveLength(6);
    expect(pages[3].canvas.rows[0].title).toContain('yok');
  });
});

describe('donate canvas', () => {
  it('PNG buffer uretir', async () => {
    const { renderDonatePng } = await import('../src/ui/canvas/donate.js');
    const png = renderDonatePng({
      title: 'Donate Genel Bakış',
      subtitle: 'Rehber',
      page: { index: 1, total: 6 },
      stats: [
        { label: 'Kayıt', value: '12' },
        { label: 'Paket', value: '3' },
        { label: 'Yöntem', value: '2' },
      ],
      rows: [
        { title: '1) Paketini seç', subtitle: 'İncele' },
        { title: '2) Ödemeyi tamamla', subtitle: 'Not yaz', value: '100 TL' },
      ],
      footer: 'Alt bilgi',
    });
    expect(png).toBeTruthy();
    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.length).toBeGreaterThan(1000);
  });
});

describe('donate veri katmani', () => {
  it('ekle -> listele -> guncelle -> sil akisi calisir', async () => {
    const { addDonate, getDonate, listDonates, removeDonate, updateDonate } = await import('../src/modules/fivem/lib/donate.js');
    const guildId = `g-${Math.random().toString(36).slice(2, 8)}`;

    const doc = await addDonate({ guildId, userId: 'u1', userTag: 'Ali', paket: 'VIP', amount: '100 TL', actorId: 'a1' });
    expect(doc.donate_id).toMatch(/^d-/);

    const listed = await listDonates(guildId, { limit: 10 });
    expect(listed.map((row) => row.donate_id)).toContain(doc.donate_id);

    const updated = await updateDonate(guildId, doc.donate_id, { paket: 'VIP+', amount: '250 TL', note: 'hediye' });
    expect(updated).toBe(true);
    const fresh = await getDonate(guildId, doc.donate_id);
    expect(fresh.package).toBe('VIP+');
    expect(fresh.amount).toBe('250 TL');
    expect(fresh.note).toBe('hediye');

    const removed = await removeDonate(guildId, doc.donate_id);
    expect(removed).toBe(true);
    expect(await getDonate(guildId, doc.donate_id)).toBeNull();
  });

  it('bos guncelleme reddedilir', async () => {
    const { addDonate, removeDonate, updateDonate } = await import('../src/modules/fivem/lib/donate.js');
    const guildId = `g-${Math.random().toString(36).slice(2, 8)}`;
    const doc = await addDonate({ guildId, userId: 'u2', paket: 'X', actorId: 'a1' });
    expect(await updateDonate(guildId, doc.donate_id, {})).toBe(false);
    expect(await updateDonate(guildId, doc.donate_id, { paket: undefined, amount: undefined, note: undefined })).toBe(false);
    await removeDonate(guildId, doc.donate_id);
  });
});

describe('karar oylama karti', () => {
  it('oy sayaclari ile kart uretir ve buton idleri dogru', async () => {
    const { buildVoteCard, policyLine } = await import('../src/modules/karar/lib/card.js');
    const decision = {
      decision_id: 'k-1',
      title: 'Test Kararı',
      status: 'acik',
      ends_at: new Date(Date.now() + 3600_000).toISOString(),
      policy: { requiredVotes: 3, majority: 'basit', durationMinutes: 60, vetoRoleIds: [] },
    };
    const tally = { counts: { evet: 2, hayir: 1, cekimser: 0 }, total: 3, effective: 3, quorumMet: true, passed: true, policy: decision.policy };
    const json = JSON.stringify(buildVoteCard(t, decision, tally, { mode: 'open' }));
    expect(json).toContain('karar:oyla:evet:k-1');
    expect(json).toContain('karar:oyla:hayir:k-1');
    expect(json).toContain('karar:oyla:cekimser:k-1');
    expect(json).toContain('karar:sonuc:k-1');
    // Sayilar karta islenmis
    expect(json).toContain('Hayır: 1');
    expect(policyLine(t, decision.policy)).toContain('3');
  });

  it('kapali kararda buton olmaz, sonuc satiri gelir', async () => {
    const { buildVoteCard } = await import('../src/modules/karar/lib/card.js');
    const decision = {
      decision_id: 'k-2',
      title: 'Kapandı',
      status: 'kapandi',
      result: 'kabul',
      ends_at: new Date(Date.now() - 1000).toISOString(),
      policy: { requiredVotes: 3, majority: 'basit', durationMinutes: 60, vetoRoleIds: [] },
    };
    const tally = { counts: { evet: 5, hayir: 0, cekimser: 0 }, total: 5, effective: 5, quorumMet: true, passed: true, policy: decision.policy };
    const json = JSON.stringify(buildVoteCard(t, decision, tally, { mode: 'open' }));
    expect(json).not.toContain('karar:oyla:evet');
  });
});
