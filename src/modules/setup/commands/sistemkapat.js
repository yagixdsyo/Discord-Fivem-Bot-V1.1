/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { disabledCard } from '../../../ui/templates/base.js';
import {
  confirm as confirmTemplate,
  error as errorTemplate,
  info as infoTemplate,
  warn as warnTemplate,
} from '../../../ui/templates/index.js';
import { waitForInteraction } from '../lib/interact.js';
import { isSystemOn, resolveSystem } from '../lib/systems.js';
import { applySystemToggle } from '../lib/toggle.js';
import { systemToggleCard } from '../lib/view.js';

export default {
  name: 'sistemkapat',
  aliases: ['sistem-kapat'],
  description: 'Bir sistemi bu sunucuda durdurur (veri silinmez).',
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
    { name: 'sebep', type: 'rest', required: false, description: 'Kapatma sebebi' },
  ],
  examples: ['/sistemkapat sistem:guard', '.sistemkapat mazeret görevli değilim'],

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

    const reason = ctx.args.sebep ? String(ctx.args.sebep).trim() : null;
    const currentlyOn = await isSystemOn(ctx.guild.id, system.id);
    if (!currentlyOn) {
      await ctx.reply(
        infoTemplate(t('setup.toggle.already_off_title'), [
          t('setup.toggle.already_off_body', { sistem: system.name }),
        ]),
      );
      return;
    }

    let confirmInteraction = null;
    if (system.id === 'guard') {
      // Guard: onay + uyari zorunlu
      const confirmCard = confirmTemplate({
        title: t('setup.guard.title'),
        description: [t('setup.guard.body'), t('setup.guard.notify_note'), t('setup.guard.confirm_hint')],
        confirmId: `setupkapat:onay:${ctx.user.id}`,
        cancelId: `setupkapat:iptal:${ctx.user.id}`,
        confirmLabel: t('setup.guard.confirm'),
        cancelLabel: t('setup.confirm.confirm_cancel'),
        danger: true,
      });
      const message = await ctx.reply(confirmCard, { fetchReply: true });
      if (!message || typeof message.awaitMessageComponent !== 'function') return;

      const decision = await waitForInteraction(message, ctx.user.id);
      if (!decision || decision.customId !== `setupkapat:onay:${ctx.user.id}`) {
        const cancelled = warnTemplate(t('setup.cancel.title'), [t('setup.cancel.body')]);
        if (decision) await decision.update(cancelled).catch(() => {});
        else await message.edit(disabledCard(confirmCard)).catch(() => {});
        return;
      }
      confirmInteraction = decision;
    }

    const result = await applySystemToggle(ctx, { system, enabled: false, reason });
    const resultCard = result.ok
      ? systemToggleCard(t, { system, enabled: false, reason })
      : errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]);

    if (confirmInteraction) {
      await confirmInteraction.update(resultCard).catch(() => {});
    } else {
      await ctx.reply(resultCard);
    }
  },
};
