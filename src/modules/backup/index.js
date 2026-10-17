/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AUTO_CHECK_MS, runAutoBackups } from './lib/auto.js';

let timer = null;

export default {
  id: 'backup',
  name: 'Backup',
  description: 'Sunucu yapılandırması yedekleme ve geri kurma.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,

  async setup(client, { logger }) {
    runAutoBackups(client)
      .then((count) => {
        if (count > 0) logger.info({ count }, 'Otomatik backup alındı');
      })
      .catch(() => {});

    timer = setInterval(() => {
      runAutoBackups(client)
        .then((count) => {
          if (count > 0) logger.info({ count }, 'Otomatik backup alındı');
        })
        .catch(() => {});
    }, AUTO_CHECK_MS);
    timer.unref?.();

    logger.info('Backup modulu hazir');
  },

  async teardown() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  },
};
