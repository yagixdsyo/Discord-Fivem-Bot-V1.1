/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor } from '../lib/pipeline.js';
import { channelSnapshot, revertChannelOverwrites } from '../lib/restore.js';
import { permissionDiff } from '../../logging/lib/helpers.js';

export default {
  name: 'channelUpdate',
  async execute(oldChannel, newChannel, meta) {
    const guild = newChannel?.guild;
    if (!guild) return;

    const overwriteLines = permissionDiff(oldChannel, newChannel) ?? [];
    const nameChanged = oldChannel?.name !== undefined && newChannel.name !== oldChannel.name;
    const topicChanged = oldChannel?.topic !== undefined && newChannel.topic !== oldChannel.topic;
    const nsfwChanged = oldChannel?.nsfw !== undefined && Boolean(newChannel.nsfw) !== Boolean(oldChannel.nsfw);
    const slowmodeChanged =
      oldChannel?.rateLimitPerUser !== undefined && newChannel.rateLimitPerUser !== oldChannel.rateLimitPerUser;

    if (overwriteLines.length === 0 && !nameChanged && !topicChanged && !nsfwChanged && !slowmodeChanged) return;

    const { ok } = await guardGate(guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(guild.id);
    if (!config.modules.kanal.enabled) return;

    const snapshot = channelSnapshot(oldChannel);
    const actorResult = await judgeActor({
      guild,
      client: meta?.client,
      config: meta?.config,
      moduleKey: 'kanal',
      auditType: AuditLogEvent.ChannelUpdate,
      targetId: newChannel.id,
      force: true,
    });

    const descriptionParts = [];
    if (nameChanged) descriptionParts.push(`isim: \`${oldChannel.name}\` → \`${newChannel.name}\``);
    if (topicChanged) descriptionParts.push('konu değişti');
    if (nsfwChanged) descriptionParts.push('NSFW değişti');
    if (slowmodeChanged) descriptionParts.push(`yavaş mod: ${oldChannel.rateLimitPerUser} → ${newChannel.rateLimitPerUser}`);
    if (overwriteLines.length > 0) descriptionParts.push(...overwriteLines);

    await handleViolation({
      guild,
      client: meta?.client,
      config,
      moduleKey: 'kanal',
      type: 'channel_update',
      description: `Yetkisiz kanal değişikliği: **#${newChannel.name}**`,
      target: `#${newChannel.name}`,
      actorResult,
      restoreFn: async () => {
        const errors = [];
        if (overwriteLines.length > 0) {
          const reverted = await revertChannelOverwrites(newChannel, snapshot);
          if (!reverted) errors.push('izinler');
        }
        if (nameChanged) await newChannel.setName(oldChannel.name, 'Guard: isim geri alindi').catch(() => errors.push('isim'));
        if (topicChanged) await newChannel.setTopic(oldChannel.topic ?? null, 'Guard: konu geri alindi').catch(() => errors.push('konu'));
        if (nsfwChanged) await newChannel.setNSFW(Boolean(oldChannel.nsfw), 'Guard: NSFW geri alindi').catch(() => errors.push('nsfw'));
        if (slowmodeChanged) {
          await newChannel.setRateLimitPerUser(oldChannel.rateLimitPerUser ?? 0, 'Guard: yavas mod geri alindi').catch(() => errors.push('yavas mod'));
        }
        return errors.length === 0
          ? { ok: true, target: `#${newChannel.name}` }
          : { ok: false, error: `geri alınamadı: ${errors.join(', ')}` };
      },
    });
  },
};
