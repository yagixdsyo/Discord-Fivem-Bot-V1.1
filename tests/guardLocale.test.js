/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import { t } from '../src/locales/index.js';
import { GUARD_MODULES, PUNISH_TYPES } from '../src/modules/guard/lib/config.js';

describe('guard locale', () => {
  it('her modul icin aciklama metni var', () => {
    for (const def of GUARD_MODULES) {
      const key = `guard.module_desc.${def.key}`;
      const value = t('tr', key);
      expect(value, key).not.toBe(key);
      expect(String(value).length).toBeGreaterThan(10);
    }
  });

  it('her ceza turu icin etiket var', () => {
    for (const punish of PUNISH_TYPES) {
      const key = `guard.punish.${punish}`;
      expect(t('tr', key), key).not.toBe(key);
    }
  });

  it('kritik guard/backup kart anahtarlari cozulur', () => {
    const keys = [
      'guard.status.title',
      'guard.status.threshold',
      'guard.test.note',
      'guard.undo.done_title',
      'guard.night.disabled_woke',
      'guard.night.sleeping_yes',
      'guard.raid.remaining',
      'guard.safe.added_body',
      'guard.protected.added_body',
      'guard.links.added_body',
      'guard.perf.title',
      'guard.incidents.title',
      'guard.ayar.hint',
      'backup.plan.title',
      'backup.plan.confirm_hint',
      'backup.result.title',
      'backup.result.remapped_note',
      'backup.role.not_found',
      'backup.channel.not_found',
      'backup.delete.done_body',
      'backup.delete_extra.confirm',
      'backup.missing.hint',
      'setup.db_not_ready.title',
      'setup.cancel.title',
    ];
    for (const key of keys) {
      expect(t('tr', key), key).not.toBe(key);
    }
  });

  it('interpolasyon yer tutuculari korunur', () => {
    expect(t('tr', 'guard.status.threshold', { limit: 3, window: 30 })).toContain('3');
    expect(t('tr', 'backup.delete.done_body', { adet: 4 })).toContain('4');
  });
});
