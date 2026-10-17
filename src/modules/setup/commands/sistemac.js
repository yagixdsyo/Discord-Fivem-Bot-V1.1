/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  error as errorTemplate,
  info as infoTemplate,
} from '../../../ui/templates/index.js';
import { isSystemOn, resolveSystem } from '../lib/systems.js';
import { applySystemToggle } from '../lib/toggle.js';
import { systemToggleCard } from '../lib/view.js';

export default {
  name: 'sistemaç',
  aliases: ['sistem-ac', 'sistemac'],
  description: 'Kapatılmış bir sistemi bu sunucuda yeniden çalıştırır.',
  category: 'Sistem',
  cooldown: 5,
  permission: { discord: ['Administrator'] },
  args: [
    {
      name: 'sistem',
      type: 'string',
      required: true,
      description: 'Sistem kimliği: guard, backup, moderasyon, ticket, mesai, mazeret...',
    },
  ],
  examples: ['/sistemaç sistem:guard', '.sistem-ac mazeret'],

  async run(ctx) {
    const t = ctx.t;
    const system = resolveSystem(ctx.args.sistem);
    if (!system) {
      await ctx.reply(errorTemplate(t('setup.toggle.not_found_title'), [t('setup.toggle.not_found_body')]));
      return;
    }
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const currentlyOn = await isSystemOn(ctx.guild.id, system.id);
    if (currentlyOn) {
      await ctx.reply(
        infoTemplate(t('setup.toggle.already_on_title'), [
          t('setup.toggle.already_on_body', { sistem: system.name }),
        ]),
      );
      return;
    }

    const result = await applySystemToggle(ctx, { system, enabled: true });
    const resultCard = result.ok
      ? systemToggleCard(t, { system, enabled: true })
      : errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]);
    await ctx.reply(resultCard);
  },
};
