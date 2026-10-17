/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { findAuditActor } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';

export default {
  name: 'webhooksUpdate',
  async execute(channel) {
    const guild = channel?.guild ?? null;
    if (!guild) return;
    const actor = await findAuditActor(guild, null, null, {
      channelId: channel.id,
      important: true,
    });
    await emitLog(guild, 'log_webhook', {
      actor: actor?.actorId ?? null,
      actorTag: actor?.actorTag ?? null,
      lines: [`Kanal webhookları güncellendi: <#${channel.id}>`],
      ids: [['Kanal', channel.id]],
    });
  },
};
