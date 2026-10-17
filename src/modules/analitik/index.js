/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerComponentHandler } from '../../ui/interactionRouter.js';
import { createTranslator } from '../../locales/index.js';
import { error as errorTemplate, success } from '../../ui/templates/index.js';

const ready = { done: false };
function registerHandlers() { if (ready.done) return; ready.done = true; }

export default {
  id: 'analitik',
  name: 'Analitik',
  description: 'Sunucu performans ve modul istatistikleri dashboard.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,
  async setup(client, { logger }) {
    registerHandlers();
    logger.info('Analitik modulu hazir');
  },
};
