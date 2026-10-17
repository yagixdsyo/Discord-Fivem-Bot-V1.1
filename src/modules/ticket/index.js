/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerTicketHandlers } from './lib/handlers.js';
import { buildTicketPanel, applyTicketPanelState } from './lib/panel.js';
import { registerSetupPanel } from '../setup/lib/panels.js';
import { createTranslator } from '../../locales/index.js';
import {
  claimTicket,
  closeTicket,
  createTicket,
  findOpenByUser,
  getTicket,
  getTicketByChannel,
  listTickets,
  reopenTicket,
} from './lib/tickets.js';

export default {
  id: 'ticket',
  name: 'Ticket',
  description: 'Ticket yönetimi: panel, kanal, transcript, puan ve yıldız sistemi.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,

  async setup(client, { logger }) {
    registerTicketHandlers();
    registerSetupPanel({
      key: 'panel_ticket',
      channelKey: 'panel_ticket',
      build: async () => buildTicketPanel(createTranslator()),
      afterPost: async ({ guild, channel, message }) =>
        applyTicketPanelState(guild.id, { channelId: channel.id, messageId: message.id }),
    });
    logger.info('Ticket modulu hazir');
  },
};

export {
  claimTicket,
  closeTicket,
  createTicket,
  findOpenByUser,
  getTicket,
  getTicketByChannel,
  listTickets,
  reopenTicket,
};
