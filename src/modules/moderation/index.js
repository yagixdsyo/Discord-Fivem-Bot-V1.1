/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ensureWarnDecayTask, registerModerationJobs } from './lib/jobs.js';
import { subscribeInviteBus } from './lib/invites.js';
import { startScheduler, stopScheduler } from './lib/schedule.js';
import { recoverOpenSessions, startStatsFlusher, stopStatsFlusher } from './lib/stats.js';

export default {
  id: 'moderation',
  name: 'Moderasyon',
  description: 'Cezalar, rol yönetimi, mesaj araçları, istatistikler ve hoş geldin.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,

  async setup(client, { config, logger }) {
    subscribeInviteBus();
    registerModerationJobs(client);
    startStatsFlusher();

    recoverOpenSessions()
      .then((count) => {
        if (count > 0) logger.info({ count }, 'Açık ses oturumları kapatıldı');
      })
      .catch(() => {});

    await startScheduler({ url: config?.redisUrl ?? null, logger });
    await ensureWarnDecayTask().catch(() => {});

    logger.info('Moderasyon modulu hazir');
  },

  async teardown() {
    await stopScheduler();
    await stopStatsFlusher();
  },
};
