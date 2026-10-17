/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import { createTranslator } from '../src/locales/index.js';
import { parseArgs } from '../src/core/argParser.js';
import { banPreviewPayload, banQueryPayload, yazPreviewPayload } from '../src/modules/moderation/lib/view.js';

const t = createTranslator('tr');

const REQUIRED_KEYS = [
  'moderation.types.ban',
  'moderation.types.permaban',
  'moderation.types.mute',
  'moderation.types.kick',
  'moderation.types.whitelist',
  'moderation.types.uyari',
  'moderation.errors.self.title',
  'moderation.errors.self.body',
  'moderation.errors.bot_self.body',
  'moderation.errors.owner.body',
  'moderation.errors.hierarchy.body',
  'moderation.errors.bot_hierarchy.body',
  'moderation.errors.bot_perm.body',
  'moderation.errors.discord.body',
  'moderation.errors.permanent_only.body',
  'moderation.errors.no_active_ban.body',
  'moderation.errors.no_active_perma.body',
  'moderation.errors.no_active_mute.body',
  'moderation.errors.mute_max.body',
  'moderation.errors.duration_required.body',
  'moderation.errors.role_denied.title',
  'moderation.errors.role_denied.body',
  'moderation.role.deny.rol_yok',
  'moderation.role.deny.bot_konum',
  'moderation.role.deny.aktorden_yuksek',
  'moderation.role.deny.tehlikeli_kisitli',
  'moderation.role.via.komut',
  'moderation.result.ban',
  'moderation.result.unban',
  'moderation.result.mute',
  'moderation.result.unmute',
  'moderation.result.kick',
  'moderation.result.permaban',
  'moderation.ban.preview.title',
  'moderation.ban.preview.user',
  'moderation.ban.preview.permanent',
  'moderation.ban.preview.duration',
  'moderation.ban.preview.confirm',
  'moderation.ban.dm_title',
  'moderation.ban.dm_perma_title',
  'moderation.ban_list.filters.aktif',
  'moderation.ban_list.filters.sureli',
  'moderation.ban_list.filters.kalici',
  'moderation.ban_list.filters.gecmis',
  'moderation.query.title',
  'moderation.query.unban_button',
  'moderation.appeal.form_title',
  'moderation.appeal.form_button',
  'moderation.appeal.modal_reason',
  'moderation.appeal.decision_title',
  'moderation.appeal.approve',
  'moderation.appeal.reject',
  'moderation.appeal.dm_approved_title',
  'moderation.appeal.dm_rejected_title',
  'moderation.appeals.status.beklemede',
  'moderation.appeals.status.onaylandi',
  'moderation.appeals.status.reddedildi',
  'moderation.warn.type.genel',
  'moderation.warn.type.etkinlik',
  'moderation.warn.type.arac',
  'moderation.warn.given_title',
  'moderation.warn.dm_title',
  'moderation.snipe.title_silme',
  'moderation.snipe.title_duzenleme',
  'moderation.where.status.online',
  'moderation.where.status.idle',
  'moderation.where.status.dnd',
  'moderation.where.status.offline',
  'moderation.where.status_label',
  'moderation.autorole.title',
  'moderation.autorole.changed_role',
  'moderation.autorole.changed_off',
  'moderation.bulk.confirm_title',
  'moderation.clear.confirm_title',
  'moderation.renew.confirm_title',
  'moderation.write.preview_title',
  'moderation.write.send',
  'moderation.bot.title',
  'moderation.invite.title',
  'moderation.invite.leader_title',
  'moderation.top.title',
  'moderation.stats.title',
  'moderation.yetki.given_title',
  'moderation.yetki.not_protected_title',
];

describe('moderation yerellestirme anahtarlari', () => {
  it('tum kritik anahtarlar metin doner (anahtar adi degil)', () => {
    const missing = REQUIRED_KEYS.filter((key) => {
      const value = t(key);
      return typeof value !== 'string' || value === key || value.length === 0;
    });
    expect(missing).toEqual([]);
  });
});

describe('moderation kart sozlesmeleri (customId)', () => {
  it('ban onay karti banonay/baniptal butonlarini tasir', () => {
    const payload = banPreviewPayload(t, {
      userId: '222222222222222222',
      userTag: 'hedef',
      accountCreatedSec: 1700000000,
      warnCount: 1,
      activeCount: 0,
      durationText: null,
      reason: 'test sebebi',
      ownerId: '999999999999999999',
    });
    const json = JSON.stringify(payload);
    expect(json).toContain('banonay:999999999999999999');
    expect(json).toContain('baniptal:999999999999999999');
  });

  it('ban sorgu karti aktif kayitta unban butonu tasir', () => {
    const payload = banQueryPayload(t, {
      doc: {
        case_id: 'c-test',
        user_id: '222222222222222222',
        active: true,
        permanent: false,
        reason: 'sebep',
        actor_id: '111111111111111111',
        created_at: new Date().toISOString(),
        expires_at: null,
        lifted_at: null,
      },
      ownerId: '999999999999999999',
    });
    expect(JSON.stringify(payload)).toContain('bansorgu:unban:c-test:999999999999999999');
  });

  it('duyuru onizleme karti yazgonder/yaziptal butonlarini tasir', () => {
    const payload = yazPreviewPayload(t, {
      title: 'Duyuru',
      description: 'Merhaba',
      colorHex: '#5865F2',
      imageUrl: null,
      buttonLabel: null,
      buttonUrl: null,
      ownerId: '999999999999999999',
    });
    const json = JSON.stringify(payload);
    expect(json).toContain('yazgonder:999999999999999999');
    expect(json).toContain('yaziptal:999999999999999999');
  });
});

describe('argParser/istege bagli orta arguman atlama', () => {
  const COMMAND = {
    args: [
      { name: 'sure', type: 'duration', required: false },
      { name: 'sebep', type: 'rest', required: false },
    ],
  };

  it('sure cozulemezse son rest argumanina kaydirilir', async () => {
    const result = await parseArgs({ command: COMMAND, tokens: ['spam', 'yazısı'] });
    expect(result.ok).toBe(true);
    expect(result.args.sure).toBeUndefined();
    expect(result.args.sebep).toBe('spam yazısı');
  });

  it('sure cozulurse normal isler', async () => {
    const result = await parseArgs({ command: COMMAND, tokens: ['2g', 'spam'] });
    expect(result.ok).toBe(true);
    expect(result.args.sure.ms).toBe(172_800_000);
    expect(result.args.sebep).toBe('spam');
  });

  it('zorunlu orta arguman atlanmaz', async () => {
    const required = {
      args: [
        { name: 'sure', type: 'duration', required: true },
        { name: 'sebep', type: 'rest', required: false },
      ],
    };
    const result = await parseArgs({ command: required, tokens: ['spam', 'yazısı'] });
    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe('duration_invalid');
  });
});
