/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { setErrorGuildNotifier } from '../../core/errorHandler.js';
import { refreshInvites } from './lib/cache.js';
import { flushCounters } from './lib/counters.js';
import { emitLog } from './lib/emit.js';
import { scanQueuedChannels, setQueueClient, stopAllWorkers } from './lib/queue.js';

const FLUSH_MS = 30_000;
let flusher = null;

export default {
  id: 'logging',
  name: 'Loglama',
  description: 'Tüm log olayları, kuyruklu gönderim, sayaçlar ve silinemez log koruması.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: true,

  async setup(client, { logger }) {
    setQueueClient(client);

    // Bot hatalarini sunucunun bot-hata-log kanalina kopru
    setErrorGuildNotifier(async (entry) => {
      const guildId = entry?.context?.guildId;
      if (!guildId) return;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;
      await emitLog(guild, 'log_bot_hata', {
        accent: 'error',
        lines: [
          `Kod: \`${entry.code}\``,
          `Kaynak: \`${entry.context?.source ?? '-'}\``,
          entry.context?.command ? `Komut: **${entry.context.command}**` : null,
        ].filter(Boolean),
        ids: [['Hata', entry.code]],
      });
    });

    // Sayaçlari periyodik olarak MongoDB'ye tasi (write-behind)
    flusher = setInterval(() => {
      const guildIds = [...client.guilds.cache.keys()];
      flushCounters(guildIds).catch(() => {});
    }, FLUSH_MS);
    flusher.unref?.();

    // Davet onbellegi (davet-log icin)
    for (const guild of client.guilds.cache.values()) {
      refreshInvites(guild).catch(() => {});
    }

    // Yeniden baslatma sonrasi Redis'te bekleyen log kuyruklarini canlandir
    const revived = await scanQueuedChannels().catch(() => 0);
    logger.info({ kuyruk: revived }, 'Loglama modulu hazir');
  },

  async teardown(client) {
    if (flusher) {
      clearInterval(flusher);
      flusher = null;
    }
    stopAllWorkers();
    await flushCounters([...client.guilds.cache.keys()]).catch(() => {});
  },
};
