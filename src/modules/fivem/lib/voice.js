/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export function voiceHumans(channel) {
  if (!channel?.members) return [];
  return [...channel.members.values()].filter((member) => !member.user?.bot);
}

/** Tek uyeyi hedef ses kanalina tasir. */
export async function moveMember(member, channelId, { reason } = {}) {
  if (!member?.voice?.channelId) return { ok: false, error: 'seste_degil' };
  if (member.voice.channelId === channelId) return { ok: false, error: 'zaten_orada' };
  try {
    await member.voice.setChannel(channelId, reason);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

/** Kullanicinin bulundugu kanaldaki herkesi hedef kanala tasir. */
export async function moveFromUsersChannel(user, targetChannelId, { reason, exemptIds = new Set() } = {}) {
  const channel = user?.voice?.channel;
  if (!channel) return { ok: false, error: 'seste_degil' };

  let moved = 0;
  const failed = [];
  for (const member of voiceHumans(channel)) {
    if (member.id === user.id || exemptIds.has(member.id)) continue;
    if (member.voice.channelId === targetChannelId) continue;
    const result = await moveMember(member, targetChannelId, { reason });
    if (result.ok) moved += 1;
    else failed.push(member.id);
  }
  return { ok: true, moved, failed, total: voiceHumans(channel).length };
}

/** Kanaldaki tum uyelerin (muaf haric) sunucu mikrofonunu acar/kapatir. */
export async function setChannelMute(channel, muted, { exemptIds = new Set(), reason } = {}) {
  let changed = 0;
  const failed = [];
  for (const member of voiceHumans(channel)) {
    if (exemptIds.has(member.id)) continue;
    if (member.voice.serverMute === muted) continue;
    try {
      await member.voice.setMute(muted, reason);
      changed += 1;
    } catch {
      failed.push(member.id);
    }
  }
  return { ok: true, changed, failed };
}

/** Ses kanalini kilitler/acar (@everyone Connect). */
export async function lockVoiceChannel(guild, channel, locked, { reason } = {}) {
  try {
    await channel.permissionOverwrites.edit(
      guild.roles.everyone.id,
      { Connect: locked ? false : null },
      { reason },
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

/** Ses kanalina kullanici limiti koyar (0 = limitsiz). */
export async function setVoiceLimit(channel, limit, { reason } = {}) {
  try {
    await channel.setUserLimit(Math.max(0, Math.min(99, Number(limit) || 0)), reason);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

/** ID listesindeki uyeleri hedef ses kanalina ceker (basarisizlari doner). */
export async function pullUsers(guild, ids, targetChannelId, { reason } = {}) {
  const moved = [];
  const failed = [];
  for (const id of ids) {
    try {
      const member = guild.members.cache.get(id) ?? (await guild.members.fetch(id).catch(() => null));
      if (!member?.voice?.channelId) {
        failed.push(id);
        continue;
      }
      if (member.voice.channelId === targetChannelId) continue;
      await member.voice.setChannel(targetChannelId, reason);
      moved.push(id);
    } catch {
      failed.push(id);
    }
  }
  return { ok: true, moved, failed };
}
