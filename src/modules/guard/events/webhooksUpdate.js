/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';
import { resolveAuditActor } from '../lib/auditQueue.js';

const CANDIDATE_TYPES = [AuditLogEvent.WebhookCreate, AuditLogEvent.WebhookDelete, AuditLogEvent.WebhookUpdate];

export default {
  name: 'webhooksUpdate',
  async execute(channel, meta) {
    const guild = channel?.guild;
    if (!guild) return;

    const { ok } = await guardGate(guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(guild.id);
    if (!config.modules.webhook.enabled) return;

    let resolved = null;
    let matchedType = null;
    for (const type of CANDIDATE_TYPES) {
      resolved = await resolveAuditActor(guild, type, null, { channelId: channel.id, force: true });
      if (resolved?.actorId) {
        matchedType = type;
        break;
      }
    }
    if (!resolved?.actorId) return;

    const actorResult = await judgeActor({
      guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'webhook',
      auditType: matchedType,
      resolvedActor: resolved,
    });

    const targetWebhook = resolved.entry?.target ?? null;
    const webhookName = targetWebhook?.name ?? 'bilinmeyen';

    await handleViolation({
      guild,
      client: meta?.client,
      config,
      moduleKey: 'webhook',
      type: matchedType === AuditLogEvent.WebhookCreate ? 'webhook_create' : matchedType === AuditLogEvent.WebhookDelete ? 'webhook_delete' : 'webhook_update',
      description: `Webhook işlemi (#${channel.name}): **${webhookName}**`,
      target: webhookName,
      actorResult,
      restoreFn: async () => {
        if (matchedType === AuditLogEvent.WebhookCreate && targetWebhook?.id) {
          try {
            const webhooks = await channel.fetchWebhooks();
            const created = webhooks.get(targetWebhook.id);
            if (created) await created.delete('Guard: yetkisiz webhook oluşturma');
            return { ok: true, target: webhookName };
          } catch (err) {
            return { ok: false, error: err?.message ?? 'webhook silinemedi' };
          }
        }
        if (matchedType === AuditLogEvent.WebhookDelete) {
          try {
            const restoredWebhook = await channel.createWebhook({ name: webhookName, reason: 'Guard: silinen webhook geri kuruldu' });
            return { ok: true, target: webhookName, newId: restoredWebhook.id };
          } catch (err) {
            return { ok: false, error: err?.message ?? 'webhook geri kurulamadı' };
          }
        }
        return { ok: false, error: 'bu webhook işlemi geri alınamaz' };
      },
    });
  },
};
