/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { systemReady } from '../../fivem/lib/gate.js';
import {
  createRoom,
  deleteRoom,
  getRoomByChannel,
  getRoomByOwner,
  getRoomsConfig,
  postRoomPanel,
  refreshRoomPanel,
} from '../lib/rooms.js';
import { createTranslator } from '../../../locales/index.js';

function isChannelEmpty(channel) {
  if (!channel?.members) return false;
  return [...channel.members.values()].every((member) => member.user?.bot);
}

export default {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const guild = newState?.guild ?? oldState?.guild;
    if (!guild) return;
    if (!(await systemReady(guild.id, 'ozel_oda'))) return;

    const member = newState.member ?? oldState.member;
    const config = await getRoomsConfig(guild.id);
    const moved = oldState.channelId !== newState.channelId;

    // 1) Sahip kendi odasindan ayrilirsa: ayarliysa oda hemen silinir.
    if (member && moved && oldState.channelId) {
      const ownRoom = await getRoomByChannel(guild.id, oldState.channelId).catch(() => null);
      if (ownRoom && ownRoom.owner_id === member.id && config.ownerLeaveDelete) {
        await deleteRoom(guild, ownRoom, { reason: 'Oda sahibi ayrildi' });
      }
    }

    // 2) Join-to-create: hub kanalina giren oyuncuya oda acilir.
    if (member && !member.user?.bot && moved && newState.channelId) {
      if (config.hubChannelId && newState.channelId === config.hubChannelId) {
        const existing = await getRoomByOwner(guild.id, member.id);
        if (existing) {
          const existingChannel =
            guild.channels.cache.get(existing.channel_id) ?? (await guild.channels.fetch(existing.channel_id).catch(() => null));
          if (existingChannel) {
            await member.voice.setChannel(existingChannel).catch(() => {});
          } else {
            await deleteRoom(guild, existing, { reason: 'Kanal kayip; yeniden olusturuluyor' });
            const recreated = await createRoom(guild, member);
            if (recreated.ok) {
              await member.voice.setChannel(recreated.channel).catch(() => {});
              await postRoomPanel(guild, recreated.doc, createTranslator());
            }
          }
        } else {
          const result = await createRoom(guild, member);
          if (result.ok) {
            await member.voice.setChannel(result.channel).catch(() => {});
            await postRoomPanel(guild, result.doc, createTranslator());
          }
        }
      }
    }

    // 3) Odadan ayrilis: bosaldiysa sil, degilse paneli tazele.
    if (moved && oldState.channelId) {
      const room = await getRoomByChannel(guild.id, oldState.channelId).catch(() => null);
      if (room) {
        const channel = guild.channels.cache.get(oldState.channelId) ?? (await guild.channels.fetch(oldState.channelId).catch(() => null));
        if (channel) {
          if (isChannelEmpty(channel)) {
            await deleteRoom(guild, room, { reason: 'Oda bosaldi' });
          } else {
            await refreshRoomPanel(guild, room, createTranslator()).catch(() => {});
          }
        }
      }
    }

    // 4) Odaya giris: panel uye listesi tazelenir.
    if (member && !member.user?.bot && moved && newState.channelId) {
      const room = await getRoomByChannel(guild.id, newState.channelId).catch(() => null);
      if (room) await refreshRoomPanel(guild, room, createTranslator()).catch(() => {});
    }
  },
};
