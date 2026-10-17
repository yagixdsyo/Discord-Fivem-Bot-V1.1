/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { disabledCard } from '../../../ui/templates/base.js';
import { error as errorTemplate, success as successTemplate, warn as warnTemplate } from '../../../ui/templates/index.js';
import { ensureMessage, waitForInteraction } from '../../setup/lib/interact.js';
import { findIncident, markIncidentUndone } from '../lib/incidents.js';
import { liftPunishment } from '../lib/punish.js';
import { guardUndoConfirmPayload } from '../lib/view.js';

export default {
  name: 'guard-geri-al',
  aliases: ['guardgerial'],
  description: 'Bir guard olayının cezasını geri alır (unban + rol iadesi).',
  category: 'Guard',
  system: 'guard',
  cooldown: 5,
  permission: { discord: ['Administrator'] },
  args: [{ name: 'olay', type: 'string', required: true, description: 'Olay kimliği (ör. gi-...)' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const incidentId = String(ctx.args.olay ?? '').trim();
    const incident = await findIncident(ctx.guild.id, incidentId);
    if (!incident) {
      await ctx.reply(errorTemplate(t('guard.undo.not_found_title'), [t('guard.undo.not_found_body', { olay: incidentId })]));
      return;
    }
    if (incident.undone) {
      await ctx.reply(warnTemplate(t('guard.undo.already_title'), [t('guard.undo.already_body')]));
      return;
    }
    if (!incident.actor_id) {
      await ctx.reply(errorTemplate(t('guard.undo.no_actor_title'), [t('guard.undo.no_actor_body')]));
      return;
    }

    const ownerId = ctx.user.id;
    const confirmCard = guardUndoConfirmPayload(t, { incident, ownerId });
    const message = await ensureMessage(ctx, await ctx.reply(confirmCard, { fetchReply: true }));
    if (!message || typeof message.awaitMessageComponent !== 'function') return;

    const decision = await waitForInteraction(message, ownerId);
    if (!decision || decision.customId !== `guardgeri:onay:${incident.incident_id}:${ownerId}`) {
      if (decision) await decision.update(warnTemplate(t('setup.cancel.title'), [t('setup.cancel.body')])).catch(() => {});
      else await message.edit(disabledCard(confirmCard)).catch(() => {});
      return;
    }

    const punish = incident.payload?.punish ?? {};
    const results = await liftPunishment(ctx.guild, {
      actorId: incident.actor_id,
      action: punish.action ?? incident.action,
      removedRoles: punish.removedRoles ?? [],
    });
    await markIncidentUndone(ctx.guild.id, incident.incident_id);

    await decision.update(
      successTemplate(t('guard.undo.done_title'), [
        t('guard.undo.done_actor', { kisi: `<@${incident.actor_id}>` }),
        results.unbanned ? t('guard.undo.done_unban') : t('guard.undo.done_no_unban'),
        t('guard.undo.done_roles', { adet: results.rolesRestored }),
      ]),
    ).catch(() => {});
  },
};
