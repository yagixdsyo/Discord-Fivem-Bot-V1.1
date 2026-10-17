/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../db/index.js';
import { listModules } from '../../core/moduleRegistry.js';
import { getGlobalGateState } from '../../core/ownerGate.js';
import { listMaintenanceEntries } from '../lib/state.js';
import { VERSION } from '../../core/version.js';
import { panel } from '../../ui/templates/index.js';
import { footerLine } from '../../ui/v2.js';

export default {
  name: 'sistem-durum',
  description: 'Modüllerin sağlık durumunu gösterir.',
  category: 'Sistem',

  async run(ctx) {
    const t = ctx.t;
    const modules = listModules();
    const [entries, gate] = await Promise.all([listMaintenanceEntries(), getGlobalGateState()]);

    // Global modul kayitlari + sunucu bazli kapatma sayilari
    const globalStates = new Map();
    const guildDisableCounts = new Map();
    if (isDbReady()) {
      try {
        const docs = await getCollection('guild_modules').find({}).toArray();
        for (const doc of docs) {
          if (doc.guild_id === 'global') {
            globalStates.set(doc.module_id, Boolean(doc.enabled));
          } else if (doc.enabled === false) {
            guildDisableCounts.set(doc.module_id, (guildDisableCounts.get(doc.module_id) ?? 0) + 1);
          }
        }
      } catch {
        /* tablo bos kabul edilir */
      }
    }

    const maintenanceModules = new Set(entries.modules.map((m) => m.target));

    const lines = modules.map((def) => {
      let status;
      if (def.coreModule) status = t('owner.system.core');
      else if (maintenanceModules.has(def.id)) status = t('owner.system.maintenance');
      else if (globalStates.get(def.id) === false) status = t('owner.system.disabled_global');
      else if (globalStates.get(def.id) === true) status = t('owner.system.enabled_global');
      else status = def.defaultEnabled ? t('owner.system.default_on') : t('owner.system.default_off');

      const overrides = guildDisableCounts.get(def.id) ?? 0;
      const suffix = overrides > 0 ? ` — ${t('owner.system.guild_overrides', { adet: overrides })}` : '';
      return `**${def.name}** (\`${def.id}\`) — ${status}${suffix}`;
    });

    const sections = [
      `**${t('owner.info.version')}:** ${VERSION}`,
      `**${t('owner.system.global_state')}:** ${
        gate.maintenance
          ? t('owner.value_active')
          : gate.pause
            ? t('owner.pause.active_label')
            : t('owner.value_none')
      }`,
      { separator: true },
      ...lines,
    ];

    await ctx.reply(
      panel({
        emojiKey: 'DURUM_AKTIF',
        title: t('owner.system.title'),
        sections,
        footer: footerLine([t('owner.system.footer', { adet: modules.length })]),
      }),
    );
  },
};
