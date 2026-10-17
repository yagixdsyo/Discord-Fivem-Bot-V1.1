/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { createTranslator } from '../../../locales/index.js';
import { registerSetupPanel } from '../../setup/lib/panels.js';
import { fetchServerInfo } from './cfx.js';
import { getKayitState, kayitInteractivePayload, setKayitPanel } from './kayitFlow.js';
import { buildStatusPayload } from './statusPanel.js';
import { getCfx, getStatus, setPanelConfig, setSetting } from './state.js';
import { complaintPanelPayload } from './view.js';

let registered = false;

/** Modul setup'inda bir kez cagrilir (idempotent). */
export function registerFivemSetupPanels() {
  if (registered) return;
  registered = true;

  registerSetupPanel({
    key: 'panel_durum',
    channelKey: 'panel_durum',
    build: async ({ guild }) => {
      const status = await getStatus(guild.id);
      const cfx = await getCfx(guild.id);
      const info = cfx.code ? await fetchServerInfo(cfx.code).catch(() => null) : null;
      return buildStatusPayload(createTranslator(), { status, cfx, info, guildName: guild.name });
    },
    afterPost: async ({ guild, channel, message }) => {
      await setPanelConfig(guild.id, { channelId: channel.id, messageId: message.id });
    },
  });

  registerSetupPanel({
    key: 'panel_kayit',
    channelKey: 'panel_kayit',
    build: async ({ guild }) => {
      const state = await getKayitState(guild.id);
      return kayitInteractivePayload(createTranslator(), { open: state.open });
    },
    afterPost: async ({ guild, channel, message }) => {
      await setKayitPanel(guild.id, { channelId: channel.id, messageId: message.id });
    },
  });

  registerSetupPanel({
    key: 'panel_sikayet',
    channelKey: 'panel_sikayet',
    build: async () => complaintPanelPayload(createTranslator()),
    afterPost: async ({ guild, channel, message }) => {
      await setSetting(guild.id, 'fivem.sikayet.panel', { channelId: channel.id, messageId: message.id });
    },
  });
}
