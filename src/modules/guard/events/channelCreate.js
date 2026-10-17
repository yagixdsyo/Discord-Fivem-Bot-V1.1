/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';

export default {
  name: 'channelCreate',
  async execute(channel, meta) {
    if (!channel?.guild) return;

    const { ok } = await guardGate(channel.guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(channel.guild.id);
    if (!config.modules.kanal.enabled) return;

    const actorResult = await judgeActor({
      guild: channel.guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'kanal',
      auditType: AuditLogEvent.ChannelCreate,
      targetId: channel.id,
      force: true,
    });

    await handleViolation({
      guild: channel.guild,
      client: meta?.client,
      config,
      moduleKey: 'kanal',
      type: 'channel_create',
      description: `Yetkisiz kanal oluşturma: **#${channel.name}**`,
      target: `#${channel.name}`,
      actorResult,
      restoreFn: async () => {
        try {
          await channel.delete('Guard: yetkisiz kanal oluşturma');
          return { ok: true, target: `#${channel.name}` };
        } catch (err) {
          return { ok: false, error: err?.message ?? 'silinemedi' };
        }
      },
    });
  },
};
