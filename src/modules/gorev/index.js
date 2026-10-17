/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerComponentHandler } from '../../ui/interactionRouter.js';
import { createTranslator } from '../../locales/index.js';

const ready = { done: false };
function registerHandlers() { if (ready.done) return; ready.done = true; }

export default {
  id: 'gorev',
  name: 'Gorev ve Hedef',
  description: 'Sunucu içi görev atama, teslim ve onay sistemi.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,
  async setup(client, { logger }) {
    registerHandlers();
    logger.info('Gorev modulu hazir');
  },
};
