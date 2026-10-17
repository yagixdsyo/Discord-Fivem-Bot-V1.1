/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerComponentHandler } from '../../ui/interactionRouter.js';
import { createTranslator } from '../../locales/index.js';
import { error as errorTemplate, success } from '../../ui/templates/index.js';

const ready = { done: false };
function registerHandlers() {
  if (ready.done) return;
  ready.done = true;
  registerComponentHandler('etkinlik', async (interaction, rest) => {
    const [action, eventId] = rest || [];
    const t = createTranslator();
    const lib = await import('./lib/events.js');
    const isBanned = false;
    if (isBanned) {
      await interaction.reply(errorTemplate(t('event.cant_join_title'), [t('event.cant_join')], { ephemeral: true })).catch(() => {});
      return;
    }
    if (action === 'durum') {
      const doc = await lib.getEvent(interaction.guildId, eventId);
      const going = doc?.participants?.going?.length ?? 0;
      await interaction.reply(success(t('event.status_title'), [t('event.status_line', { adet: going })], { ephemeral: true })).catch(() => {});
      return;
    }
    if (action === 'katil') await lib.respondEvent({ guildId: interaction.guildId, eventId, userId: interaction.user.id, response: 'going' });
    else if (action === 'belki') await lib.respondEvent({ guildId: interaction.guildId, eventId, userId: interaction.user.id, response: 'maybe' });
    else if (action === 'cik') await lib.respondEvent({ guildId: interaction.guildId, eventId, userId: interaction.user.id, response: 'not' });
    await interaction.reply(success(t('event.updated_title'), [t('event.updated')], { ephemeral: true })).catch(() => {});
  });
  registerComponentHandler('cekilis', async (interaction, rest) => {
    const [action, giveawayId] = rest || [];
    if (action !== 'katil') return;
    const t = createTranslator();
    const lib = await import('./lib/giveaways.js');
    const result = await lib.enterGiveaway(interaction.guildId, giveawayId, interaction.user.id);
    let payload;
    if (!result?.ok) payload = errorTemplate(t('giveaway.inactive_title'), [t('giveaway.inactive')]);
    else if (result.already) payload = errorTemplate(t('giveaway.already_title'), [t('giveaway.already')]);
    else payload = success(t('giveaway.joined_title'), [t('giveaway.joined')]);
    await interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
  });
}

export default {
  id: 'event',
  name: 'Etkinlik',
  description: 'Etkinlik, toplanti ve cekilis sistemi.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,
  async setup(client, { logger }) {
    try { registerHandlers(); logger.info('Event modulu hazir'); }
    catch (e) { logger.warn({ err: e?.message }, 'Event modulu baslatilamadi'); }
  },
};
