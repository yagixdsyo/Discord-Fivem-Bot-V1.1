/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ChannelType } from 'discord.js';
import { AuditLogEvent, findAuditActor } from '../lib/audit.js';
import { emitLog } from '../lib/emit.js';
import { channelTypeLabel } from '../lib/helpers.js';

export default {
  name: 'channelCreate',
  async execute(channel, meta) {
    if (!channel?.guild) return;
    const isCategory = channel.type === ChannelType.GuildCategory;
    const key = isCategory ? 'log_kategori' : 'log_kanal_olustur';

    const actor = await findAuditActor(channel.guild, AuditLogEvent.ChannelCreate, channel.id, {
      important: true,
    });
    // Kurulumun kendi olusturdugu kanallar logu kirletmesin
    if (actor?.actorId && meta?.client?.user && actor.actorId === meta.client.user.id) return;

    await emitLog(channel.guild, key, {
      actor: actor?.actorId ?? null,
      actorTag: actor?.actorTag ?? null,
      target: `#${channel.name}`,
      lines: [`Kanal: <#${channel.id}>`, `Tür: ${channelTypeLabel(channel.type)}`],
      ids: [['Kanal', channel.id]],
    });
  },
};
