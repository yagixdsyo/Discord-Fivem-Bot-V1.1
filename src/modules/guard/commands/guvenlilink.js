/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success as successTemplate } from '../../../ui/templates/index.js';
import { addLinkWhitelist, getLinkWhitelist, removeLinkWhitelist } from '../lib/config.js';
import { linkListPayload } from '../lib/view.js';

export default {
  name: 'guvenli-link',
  aliases: ['guvenlilink'],
  description: 'Link beyaz listesini yönetir (reklam filtresinden muaf alan adları).',
  category: 'Guard',
  system: 'guard',
  cooldown: 5,
  permission: { discord: ['Administrator'] },
  args: [
    {
      name: 'islem',
      type: 'choice',
      required: true,
      description: 'İşlem',
      choices: ['ekle', 'cikar', 'liste'].map((value) => ({ name: value, value })),
    },
    { name: 'alan', type: 'string', required: false, description: 'Alan adı (ör. youtube.com)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const islem = String(ctx.args.islem ?? 'liste').toLowerCase();

    if (islem === 'liste') {
      const entries = await getLinkWhitelist(ctx.guild.id);
      await ctx.reply(linkListPayload(t, { entries }));
      return;
    }

    const alan = ctx.args.alan ? String(ctx.args.alan) : null;
    if (!alan) {
      await ctx.reply(errorTemplate(t('guard.links.missing_title'), [t('guard.links.missing_body')]));
      return;
    }

    if (islem === 'ekle') {
      const result = await addLinkWhitelist({ guildId: ctx.guild.id, domain: alan, addedBy: ctx.user.id });
      if (!result.ok) {
        await ctx.reply(errorTemplate(t('guard.links.invalid_title'), [t('guard.links.invalid_body', { alan })]));
        return;
      }
      const entries = await getLinkWhitelist(ctx.guild.id);
      await ctx.reply(successTemplate(t('guard.links.added_title', { alan: result.domain }), [t('guard.links.added_body')]));
      await ctx.followUp(linkListPayload(t, { entries })).catch(() => {});
      return;
    }

    if (islem === 'cikar') {
      const result = await removeLinkWhitelist(ctx.guild.id, alan);
      if (!result.ok || !result.removed) {
        await ctx.reply(errorTemplate(t('guard.links.not_found_title'), [t('guard.links.not_found_body', { alan })]));
        return;
      }
      const entries = await getLinkWhitelist(ctx.guild.id);
      await ctx.reply(successTemplate(t('guard.links.removed_title', { alan }), [t('guard.links.removed_body')]));
      await ctx.followUp(linkListPayload(t, { entries })).catch(() => {});
    }
  },
};
