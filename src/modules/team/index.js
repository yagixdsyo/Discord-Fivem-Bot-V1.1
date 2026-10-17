/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerTeamHandlers } from './lib/handlers.js';
import { registerTeamSetupPanels } from './lib/setupPanels.js';

const ready = { done: false };

function registerHandlers() {
  if (ready.done) return;
  ready.done = true;
  registerTeamHandlers();
}

export default {
  id: 'team',
  name: 'Ekip',
  description: 'Legal/illegal ekip sistemi, senkron, blacklist, ekip loglari ve ekip paneli.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,
  async setup(client, { logger }) {
    try {
      registerHandlers();
      registerTeamSetupPanels();
      logger.info('Team modulu hazir');
    } catch (e) {
      logger.warn({ err: e?.message }, 'Team modulu baslatilamadi');
    }
  },
};
