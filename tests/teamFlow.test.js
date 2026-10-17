/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import { createTranslator } from '../src/locales/index.js';

const t = createTranslator('tr');

const TEAM = {
  team_id: 'team-1',
  guild_id: 'g1',
  name: 'Kartal Ekibi',
  kind: 'illegal',
  boss_id: 'b1',
  member_ids: ['b1', 'u2'],
  member_limit: 10,
  role_id: 'r1',
  color: '#ff0000',
  panel_channel_id: 'c1',
  text_channel_id: 'c1',
  application_open: true,
  closed: false,
};

describe('ekip basvuru paneli', () => {
  it('basvuru kabul eden ekipler icin sag butonlu satir uretir', async () => {
    const { buildApplyPanel } = await import('../src/modules/team/lib/apply.js');
    const payload = buildApplyPanel(t, { teams: [TEAM, { ...TEAM, team_id: 'team-2', name: 'Şahin', application_open: false }] });
    const json = JSON.stringify(payload);
    expect(json).toContain('ekipbasvuru:basvur:team-1');
    // Kapali ekip listelenmez
    expect(json).not.toContain('ekipbasvuru:basvur:team-2');
    expect(json).toContain('Başvur');
    expect(json).toContain('Kartal Ekibi');
  });

  it('bos durumda bilgilendirme satiri gosterir', async () => {
    const { buildApplyPanel } = await import('../src/modules/team/lib/apply.js');
    const json = JSON.stringify(buildApplyPanel(t, { teams: [] }));
    expect(json).toContain('başvuru kabul eden bir ekip yok');
  });

  it('8 ekipten fazlasi ek secim menusune duser', async () => {
    const { buildApplyPanel } = await import('../src/modules/team/lib/apply.js');
    const teams = Array.from({ length: 10 }, (_, i) => ({ ...TEAM, team_id: `team-${i + 1}`, name: `Ekip ${i + 1}` }));
    const json = JSON.stringify(buildApplyPanel(t, { teams }));
    expect(json).toContain('ekipbasvuru:sec');
    expect(json).toContain('Ekip 9');
  });
});

describe('ekip basvuru formu', () => {
  it('modal customId ve alanlari dogru', async () => {
    const { buildApplyModal } = await import('../src/modules/team/lib/apply.js');
    const modal = buildApplyModal(t, TEAM);
    const raw = modal.toJSON();
    expect(raw.custom_id).toBe('ekipbasvuru:form:team-1');
    expect(raw.components).toHaveLength(4);
    const labels = raw.components.map((row) => row.components[0].label);
    expect(labels[0]).toContain('ismin');
    expect(labels[1]).toContain('Yaş');
    expect(labels[3]).toContain('Neden');
  });

  it('basvuru karti onay/red butonlari tasir, sonuclaninca kaldirir', async () => {
    const { buildApplicationCard } = await import('../src/modules/team/lib/apply.js');
    const app = {
      app_id: 'ea-1',
      team_id: 'team-1',
      team_name: 'Kartal Ekibi',
      user_id: 'u9',
      fields: { isim: 'Kaan', yas: '19', deneyim: '2 yıl', neden: 'Aktif olmak istiyorum' },
      status: 'beklemede',
    };
    const pending = JSON.stringify(buildApplicationCard(t, { app, team: TEAM }));
    expect(pending).toContain('ekipbasvuru:onay:ea-1');
    expect(pending).toContain('ekipbasvuru:red:ea-1');
    expect(pending).toContain('Kaan');

    const done = JSON.stringify(buildApplicationCard(t, { app: { ...app, status: 'onaylandi' }, team: TEAM }));
    expect(done).not.toContain('ekipbasvuru:onay:ea-1');
    expect(done).toContain('Onaylandı');
  });
});

describe('ekip basvuru veri katmani', () => {
  it('basvuru olustur -> durum guncelle', async () => {
    const { createApplication, getApplication, setApplicationMessage, setApplicationStatus } = await import('../src/modules/team/lib/apply.js');
    const guildId = `g-${Math.random().toString(36).slice(2, 8)}`;
    const app = await createApplication({
      guildId,
      team: TEAM,
      user: { id: 'u9', username: 'kaan' },
      fields: { isim: 'Kaan', yas: '19', deneyim: null, neden: 'test' },
    });
    expect(app.app_id).toMatch(/^ea-/);

    const found = await getApplication(guildId, app.app_id);
    expect(found.team_id).toBe('team-1');
    expect(found.status).toBe('beklemede');

    await setApplicationMessage(guildId, app.app_id, 'c1', 'm1');
    await setApplicationStatus(guildId, app.app_id, 'onaylandi', 'b1');
    const fresh = await getApplication(guildId, app.app_id);
    expect(fresh.status).toBe('onaylandi');
    expect(fresh.message_id).toBe('m1');
  });
});

describe('ekip guncelleme', () => {
  it('guild olmadan alan guncellemesi kalici olur', async () => {
    const { insertDoc, findOneDoc } = await import('../src/modules/fivem/lib/store.js');
    const { updateTeam } = await import('../src/modules/team/lib/teams.js');
    const guildId = `g-${Math.random().toString(36).slice(2, 8)}`;
    await insertDoc('teams', { ...TEAM, guild_id: guildId });

    const done = await updateTeam({ guildId, teamId: 'team-1', patch: { name: 'Yeni Ad', color: '#00ff00' } });
    expect(done.name).toBe('Yeni Ad');
    expect(done.color).toBe('#00ff00');
    const raw = await findOneDoc('teams', { guild_id: guildId, team_id: 'team-1' });
    expect(raw.name).toBe('Yeni Ad');
  });

  it('locale anahtarlari cozulur', () => {
    expect(t('team.kind_illegal')).toBe('Illegal');
    expect(t('team.apply_button')).toBe('Başvur');
    expect(t('team.apply_field_name')).toContain('ismin');
  });
});
