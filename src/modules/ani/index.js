/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerComponentHandler } from '../../ui/interactionRouter.js';
import { createTranslator } from '../../locales/index.js';
import { card, error as errorTemplate, success } from '../../ui/templates/index.js';

const ready = { done: false };

function ts(dateLike) {
  return Math.floor(new Date(dateLike).getTime() / 1000);
}

function momentLines(t, moment) {
  const lines = [`**${moment.title}**`];
  if (moment.content) lines.push(moment.content);
  if ((moment.tags ?? []).length > 0) lines.push(t('ani.tags_line', { etiketler: moment.tags.map((x) => `\`${x}\``).join(' ') }));
  if (moment.link) lines.push(t('ani.link_line', { link: moment.link }));
  lines.push(t('ani.meta_line', { oneren: `<@${moment.proposed_by}>`, tarih: `<t:${ts(moment.approved_at ?? moment.created_at)}:d>` }));
  return lines;
}

function registerHandlers() {
  if (ready.done) return;
  ready.done = true;

  registerComponentHandler('ani', async (interaction, rest) => {
    const t = createTranslator();
    const [action, momentId] = rest ?? [];
    const lib = await import('./lib/moments.js');

    if (!interaction.member?.permissions?.has?.('ManageMessages')) {
      await interaction.reply(errorTemplate(t('ani.staff_only_title'), [t('ani.staff_only')], { ephemeral: true })).catch(() => {});
      return;
    }
    if (action !== 'onayla' && action !== 'reddet') {
      await interaction.reply(errorTemplate(t('ani.unknown_title'), [t('ani.unknown_action')], { ephemeral: true })).catch(() => {});
      return;
    }

    const approved = action === 'onayla';
    const result = await lib.reviewMoment({
      guildId: interaction.guildId,
      momentId,
      reviewerId: interaction.user.id,
      approved,
    });
    if (!result.ok) {
      await interaction.reply(errorTemplate(t('ani.review_fail_title'), [t('ani.review_fail')], { ephemeral: true })).catch(() => {});
      return;
    }

    if (approved) {
      const cfg = await lib.getConfig(interaction.guildId);
      if (cfg.archiveChannelId) {
        const channel = await interaction.client.channels.fetch(cfg.archiveChannelId).catch(() => null);
        if (channel) {
          await channel.send(card({
            emojiKey: 'BELGE',
            title: t('ani.archive_card_title'),
            subtitle: `#${momentId}`,
            accent: 'success',
            lines: momentLines(t, result.moment),
          })).catch(() => {});
        }
      }
    }

    await interaction.reply(success(t('ani.review_done_title'), [
      t(approved ? 'ani.review_approved' : 'ani.review_rejected', { id: momentId }),
    ], { ephemeral: true })).catch(() => {});
  });
}

export default {
  id: 'ani',
  name: 'Ani Arsivi',
  description: 'Topluluk anilarini onerir, onaylar, arsivler ve aylik/yillik raporlar.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,
  async setup(client, { logger }) {
    registerHandlers();
    logger.info('Ani arsivi modulu hazir');
  },
};
