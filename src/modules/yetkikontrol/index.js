/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerComponentHandler } from '../../ui/interactionRouter.js';

const ready = { done: false };
function registerHandlers() { if (ready.done) return; ready.done = true; }

export default {
  id: 'yetkikontrol',
  name: 'Yetki Kontrol',
  description: 'Log sunucusu giris korumasi (ayri bot tipi).',
  botTypes: ['yetkikontrol'],
  defaultEnabled: true,
  coreModule: false,
  async setup(client, { logger }) { try { registerHandlers(); logger.info('Yetki kontrol modulu hazir'); } catch (e) { logger.warn({ err: e?.message }, 'Yetki kontrol modulu baslatilamadi'); } },
};
