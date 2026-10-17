/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export default {
  id: 'izin',
  name: 'Izin Dedektifi',
  description: 'Rol ve kanal izinlerini tarar, riskli kombinasyonlari bulur ve etkin izinleri simule eder.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,
  async setup(client, { logger }) {
    logger.info('Izin dedektifi modulu hazir');
  },
};
