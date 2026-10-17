/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';
import { channelSnapshot, remapMappedIds, restoreChannel } from '../lib/restore.js';
import { invalidateLogChannelMap } from '../../logging/lib/cache.js';
import { channelTypeLabel } from '../../logging/lib/helpers.js';

export default {
  name: 'channelDelete',
  async execute(channel, meta) {
    if (!channel?.guild) return;

    const { ok } = await guardGate(channel.guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(channel.guild.id);
    if (!config.modules.kanal.enabled) return;

    // Snapshot olay aninda (kanal nesnesi hala dolu)
    const snapshot = channelSnapshot(channel);
    const actorResult = await judgeActor({
      guild: channel.guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'kanal',
      auditType: AuditLogEvent.ChannelDelete,
      targetId: channel.id,
      force: true,
    });

    await handleViolation({
      guild: channel.guild,
      client: meta?.client,
      config,
      moduleKey: 'kanal',
      type: 'channel_delete',
      description: `Yetkisiz kanal silme: **#${snapshot.name}** (${channelTypeLabel(snapshot.type)})`,
      target: `#${snapshot.name}`,
      actorResult,
      restoreFn: async () => {
        const idMap = new Map();
        try {
          const restored = await restoreChannel(channel.guild, snapshot, { idMap });
          await remapMappedIds(channel.guild.id, idMap);
          invalidateLogChannelMap(channel.guild.id);
          return { ok: true, target: `#${snapshot.name}`, newId: restored.id };
        } catch (err) {
          return { ok: false, error: err?.message ?? 'geri_kurulamadi' };
        }
      },
    });
  },
};
