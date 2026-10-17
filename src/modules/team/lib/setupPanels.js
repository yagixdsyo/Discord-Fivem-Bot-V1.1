/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { createTranslator } from '../../../locales/index.js';
import { registerSetupPanel } from '../../setup/lib/panels.js';
import { buildApplyPanel } from './apply.js';
import { listTeams } from './teams.js';

let registered = false;

/** Modul setup'inda bir kez cagrilir (idempotent). */
export function registerTeamSetupPanels() {
  if (registered) return;
  registered = true;

  registerSetupPanel({
    key: 'panel_ekip_basvuru',
    channelKey: 'ekip_basvuru',
    build: async ({ guild }) => {
      const teams = await listTeams(guild.id, { closed: false }).catch(() => []);
      return buildApplyPanel(createTranslator(), { teams: teams.filter((x) => x.application_open !== false) });
    },
  });
}
