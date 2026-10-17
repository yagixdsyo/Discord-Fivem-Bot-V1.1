/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerComponentHandler } from '../../ui/interactionRouter.js';
import { registerTaskHandler, scheduleTask } from '../moderation/lib/schedule.js';
import { createTranslator } from '../../locales/index.js';
import { error as errorTemplate, success } from '../../ui/templates/index.js';

const ready = { done: false };

async function ensureRegistered() {
  if (ready.done) return;
  ready.done = true;
  try {
    registerTaskHandler('sicil:unban', async ({ guildId, caseId }) => {
      const lib = await import('./lib/cases.js');
      await lib.finalizeUnban(caseId, guildId).catch(() => {});
    });
  } catch {}
  try {
    registerComponentHandler('itiraz', async (interaction, rest) => {
      const t = createTranslator();
      const [action, appealId] = rest || [];
      const guild = interaction.guild;
      if (!guild) return;
      const lib = await import('./lib/cases.js');
      const appeal = await lib.getAppeal(guild.id, appealId).catch(() => null);
      if (!appeal) {
        await interaction.reply(errorTemplate(t('ceza.appeal_missing_title'), [t('ceza.appeal_missing')], { ephemeral: true })).catch(() => {});
        return;
      }
      const approved = action === 'onay';
      const result = await lib.reviewAppeal({ guildId: guild.id, appealId, reviewerId: interaction.user.id, approved, note: '' });
      if (!result.ok) {
        await interaction.reply(errorTemplate(t('ceza.appeal_reviewed_title'), [t('ceza.appeal_reviewed')], { ephemeral: true })).catch(() => {});
        return;
      }
      await interaction.reply(success(t('ceza.appeal_decision_done_title'), [approved ? t('ceza.appeal_approved') : t('ceza.appeal_rejected')], { ephemeral: true })).catch(() => {});
      const user = await interaction.client.users.fetch(appeal.user_id).catch(() => null);
      if (user) {
        const dm = success(t('ceza.appeal_dm_title'), [t(approved ? 'ceza.appeal_dm_approved' : 'ceza.appeal_dm_rejected', { id: appeal.appeal_id })]);
        await user.send(dm).catch(() => {});
      }
    });
  } catch {}
  void scheduleTask;
}

export default {
  id: 'sicil',
  name: 'Ceza ve Sicil',
  description: 'Warn, kick, ban, jail, unban, itiraz ve staff istatistikleri.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,
  async setup(client, { logger }) {
    ensureRegistered();
    logger.info('Sicil modülü hazır');
  },
};
