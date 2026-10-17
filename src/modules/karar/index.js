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

  registerComponentHandler('karar', async (interaction, rest) => {
    const t = createTranslator();
    const lib = await import('./lib/decisions.js');
    const [action, arg1, arg2] = rest ?? [];

    if (action === 'oyla') {
      const choice = arg1;
      const decisionId = arg2;
      const result = await lib.castVote({ guildId: interaction.guildId, decisionId, userId: interaction.user.id, choice });
      if (!result.ok) {
        const messageKey = result.error === 'closed' ? 'karar.vote_closed' : result.error === 'expired' ? 'karar.vote_expired' : 'karar.vote_fail';
        await interaction.reply(errorTemplate(t('karar.vote_fail_title'), [t(messageKey)], { ephemeral: true })).catch(() => {});
        return;
      }
      const decision = await lib.getDecision(interaction.guildId, decisionId);
      const tally = await lib.tally(interaction.guildId, decision);
      // Oylama mesajini yerinde yenile: sayilar aninda guncellenir.
      const { buildVoteCard } = await import('./lib/card.js');
      try {
        await interaction.update(buildVoteCard(t, decision, tally, { mode: 'open' }));
      } catch {}
      await interaction.followUp(success(t('karar.vote_ok_title'), [
        t('karar.vote_ok', { oy: t(`karar.choice_${choice}`) }),
        t('karar.vote_counts', { evet: tally.counts.evet, hayir: tally.counts.hayir, cekimser: tally.counts.cekimser }),
      ], { ephemeral: true })).catch(() => {});
      return;
    }

    if (action === 'sonuc') {
      const decisionId = arg1;
      const decision = await lib.getDecision(interaction.guildId, decisionId);
      if (!decision) {
        await interaction.reply(errorTemplate(t('karar.not_found_title'), [t('karar.not_found')], { ephemeral: true })).catch(() => {});
        return;
      }
      const tally = await lib.tally(interaction.guildId, decision);
      const { buildVoteCard } = await import('./lib/card.js');
      await interaction.reply(buildVoteCard(t, decision, tally, { mode: 'result', ephemeral: true })).catch(() => {});
      return;
    }

    await interaction.reply(errorTemplate(t('karar.unknown_title'), [t('karar.unknown_action')], { ephemeral: true })).catch(() => {});
  });
}

export default {
  id: 'karar',
  name: 'Karar ve Oylama',
  description: 'Quorum, cogunluk, veto ve karar gecmisi ile sunucu ici karar sistemi.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,
  async setup(client, { logger }) {
    registerHandlers();
    logger.info('Karar modulu hazir');
  },
};
