/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerComponentHandler } from '../../ui/interactionRouter.js';
import { success } from '../../ui/templates/index.js';
import { createTranslator } from '../../locales/index.js';
import { registerAnnounceJobs, requestStop, startAnnounceWorker, stopAnnounceWorker } from './lib/dmQueue.js';

let handlersReady = false;

function registerHandlers() {
  if (handlersReady) return;
  handlersReady = true;

  registerComponentHandler('dmduyuru', async (interaction, rest) => {
    const t = createTranslator();
    const [action, jobId] = rest;
    if (action !== 'durdur' || !jobId) {
      await interaction.reply(success(t('announce.dm.stop_invalid'), [], { ephemeral: true })).catch(() => {});
      return;
    }

    const ok = await requestStop(interaction.guildId, jobId).catch(() => false);
    if (!ok) {
      await interaction.reply(success(t('announce.dm.stop_not_found'), [], { ephemeral: true })).catch(() => {});
      return;
    }

    await interaction.reply(success(t('announce.dm.stop_ok'), [], { ephemeral: true })).catch(() => {});
  });
}

export default {
  id: 'announce',
  name: 'DM Duyuru',
  description: 'Yetkili, rol, kişi, ekip ve oyunculara DM duyuruları gönderir.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,

  async setup(client, { config, logger }) {
    registerHandlers();
    registerAnnounceJobs(client);
    await startAnnounceWorker({ url: config?.redisUrl ?? null, logger });
    logger.info('DM duyuru modulu hazir');
  },

  async teardown() {
    await stopAnnounceWorker();
  },
};
