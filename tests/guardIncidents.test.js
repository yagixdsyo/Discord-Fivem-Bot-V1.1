/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  clearIncidentMemory,
  computeStats,
  findIncident,
  listRecentIncidents,
  makeIncidentId,
  markIncidentUndone,
  performanceStats,
  recordIncident,
} from '../src/modules/guard/lib/incidents.js';

afterEach(() => clearIncidentMemory());

describe('istatistik (saf)', () => {
  it('medyan/p90/p99 hesaplanir', () => {
    const stats = computeStats([10, 20, 30, 40]);
    expect(stats.count).toBe(4);
    expect(stats.median).toBe(20);
    expect(stats.p90).toBe(30);
    expect(stats.p99).toBe(30);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(40);
  });

  it('bos/gecersiz degerler null doner', () => {
    expect(computeStats([])).toEqual({ count: 0, median: null, p90: null, p99: null, min: null, max: null });
    expect(computeStats(['abc', NaN, undefined]).count).toBe(0);
  });

  it('olay kimligi gi- onekiyle uretilir ve benzersizdir', () => {
    const a = makeIncidentId();
    const b = makeIncidentId();
    expect(a.startsWith('gi-')).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('olay kaydi (bellek)', () => {
  it('kayit -> listele -> bul -> geri al dongusu', async () => {
    const doc = await recordIncident({
      guildId: 'g1',
      moduleKey: 'rol',
      type: 'role_delete',
      actorId: 'u1',
      actorTag: 'kisi',
      target: '@Test',
      action: 'rolleri-al',
      responseMs: 123,
      payload: { punish: { action: 'rolleri-al', removedRoles: ['r1'] } },
    });

    expect(doc.incident_id.startsWith('gi-')).toBe(true);
    expect(doc.response_ms).toBe(123);
    expect(doc.undone).toBe(false);

    const list = await listRecentIncidents('g1', 5);
    expect(list[0].incident_id).toBe(doc.incident_id);

    const found = await findIncident('g1', doc.incident_id);
    expect(found.type).toBe('role_delete');
    expect(found.payload.punish.removedRoles).toEqual(['r1']);

    await markIncidentUndone('g1', doc.incident_id);
    const undone = await findIncident('g1', doc.incident_id);
    expect(undone.undone).toBe(true);
  });

  it('guvenli (safe) kayitlar ceza sayilmaz', async () => {
    await recordIncident({ guildId: 'g2', moduleKey: 'kanal', type: 'channel_delete', actorId: 'u2', action: 'loglandi', safe: true });
    await recordIncident({ guildId: 'g2', moduleKey: 'kanal', type: 'channel_delete', actorId: 'u3', action: 'rolleri-al', responseMs: 50 });

    const perf = await performanceStats('g2', { days: 7 });
    expect(perf.total).toBe(2);
    expect(perf.safeCount).toBe(1);
    expect(perf.stats.count).toBe(1);
    expect(perf.stats.median).toBe(50);
    expect(perf.byModule.find((row) => row.module === 'kanal').count).toBe(2);
  });

  it('findIncident olmayan kimlikte null doner', async () => {
    await expect(findIncident('g3', 'gi-yok')).resolves.toBeNull();
  });
});
