/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { createTranslator } from '../../../locales/index.js';
import { registerSetupPanel } from '../../setup/lib/panels.js';
import { roomCreatePanelPayload, setRoomsConfig } from './rooms.js';

let registered = false;

/** Modul setup'inda bir kez cagrilir (idempotent). */
export function registerRoomsSetupPanels() {
  if (registered) return;
  registered = true;

  registerSetupPanel({
    key: 'panel_oda',
    channelKey: 'panel_oda',
    build: async () => roomCreatePanelPayload(createTranslator()),
    afterPost: async ({ guild, channel, message, store }) => {
      const patch = { panelChannelId: channel.id, panelMessageId: message.id };
      try {
        const channelDocs = await store?.getMap?.('channels_map', guild.id);
        const hub = (channelDocs ?? []).find((doc) => doc.key === 'oda_hub');
        if (hub?.channel_id) patch.hubChannelId = hub.channel_id;
      } catch {
        /* hub bulunamazsa yalnizca panel kaydedilir */
      }
      await setRoomsConfig(guild.id, patch);
    },
  });
}
