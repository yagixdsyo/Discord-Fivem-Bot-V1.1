/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export default {
  id: 'terfi',
  name: 'Yetkili Terfi',
  description: 'Yetkili puan, rutbe merdiveni, otomatik terfi ve canvas duyurusu.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,
  async setup(client, { logger }) {
    try {
      logger.info('Terfi modulu hazir');
    } catch {
      /* yut */
    }
  },
};
