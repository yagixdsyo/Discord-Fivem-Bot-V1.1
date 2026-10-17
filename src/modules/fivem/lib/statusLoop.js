/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getLogger } from '../../../core/logger.js';
import { refreshStatusPanel } from './statusPanel.js';
import { getPanelConfig, getStatus, setStatus } from './state.js';

let timer = null;

export function startStatusLoop(client, { intervalMs = 60_000 } = {}) {
  stopStatusLoop();
  const tick = () => {
    tickAll(client).catch((err) => getLogger().debug({ err: err?.message }, 'fivem durum dongusu hatasi'));
  };
  timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
}

export function stopStatusLoop() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Tum sunuculari dolasir (test edilebilirlik icin ayri). */
export async function tickAll(client, { t = null } = {}) {
  for (const guild of client.guilds.cache.values()) {
    try {
      await tickGuild(guild, { t });
    } catch (err) {
      getLogger().debug({ err: err?.message, guild: guild.id }, 'fivem durum dongusu: sunucu atlandi');
    }
  }
}

/** Tek sunucu: otomatik geri donus + panel yenileme. */
export async function tickGuild(guild, { t = null } = {}) {
  const panel = await getPanelConfig(guild.id);
  if (!panel.channelId) return { skipped: true };

  const status = await getStatus(guild.id);
  if (
    status.until &&
    status.autoRevert &&
    status.state !== 'aktif' &&
    Number.isFinite(Date.parse(status.until)) &&
    Date.now() > Date.parse(status.until)
  ) {
    await setStatus(guild.id, 'aktif', { note: null, by: null });
  }

  return refreshStatusPanel(guild, t ? { t } : {});
}
