/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerFivemHandlers } from './lib/handlers.js';
import { registerFivemSetupPanels } from './lib/setupPanels.js';
import { startPresenceLoop, stopPresenceLoop } from './lib/presenceLoop.js';
import { startStatusLoop, stopStatusLoop } from './lib/statusLoop.js';
import { startCfxWebhookServer, stopCfxWebhookServer } from '../../web/cfx.js';

let whServerRunning = false;

export default {
  id: 'fivem',
  name: 'FiveM',
  description: 'FiveM sunucu yönetimi: durum paneli, kayıt, whitelist, oluşum/ekip, destek, mülakat, ses ve CFX log botu.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,

  async setup(client, { config, logger }) {
    registerFivemHandlers();
    registerFivemSetupPanels();
    startStatusLoop(client, { intervalMs: 60_000 });
    startPresenceLoop(client, { intervalMs: 60_000 });

    const port = config?.fivem?.whPort ?? 3001;
    try {
      await startCfxWebhookServer({ port, client });
      whServerRunning = true;
    } catch (err) {
      whServerRunning = false;
      if (err?.code === 'EADDRINUSE') {
        logger.warn({ port }, 'CFX webhook portu kullanimda; CFX WH devre disi (baska instance olabilir)');
      } else {
        logger.warn({ port, err: err?.message }, 'CFX webhook sunucusu baslatilamadi');
      }
    }

    logger.info('FiveM modulu hazir');
  },

  async teardown() {
    stopStatusLoop();
    stopPresenceLoop();
    if (whServerRunning) {
      whServerRunning = false;
      await stopCfxWebhookServer().catch(() => {});
    }
  },
};
