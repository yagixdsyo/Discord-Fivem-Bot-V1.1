/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerComponentHandler } from '../../ui/interactionRouter.js';

const ready = { done: false };
function registerHandlers() { if (ready.done) return; ready.done = true; }

export default {
  id: 'blacklist',
  name: 'Blacklist',
  description: 'Sunucu, oyuncu ve ekip blacklist sistemi.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,
  async setup(client, { logger }) { try { registerHandlers(); logger.info('Blacklist modulu hazir'); } catch (e) { logger.warn({ err: e?.message }, 'Blacklist modulu baslatilamadi'); } },
};
