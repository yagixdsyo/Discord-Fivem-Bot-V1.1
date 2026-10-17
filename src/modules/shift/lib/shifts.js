/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getSetting, setSetting } from '../../fivem/lib/state.js';
import {
  insertDoc,
  findDocs,
  findOneDoc,
  updateDoc,
  deleteDocs,
} from '../../fivem/lib/store.js';

const SHIFTS = 'shifts';
const UNITS = 'units';
const LEAVES = 'leave_requests';
const ACTIVITY_TESTS = 'activity_tests';


function nowIso() { return new Date().toISOString(); }
function defaultConfig(raw) {
  return {
    prefix: raw?.prefix ?? '[M]',
    toleranceMinutes: Number(raw?.toleranceMinutes ?? 2),
    requireGame: !!raw?.requireGame,
    autoStartVoiceChannelIds: raw?.autoStartVoiceChannelIds ?? [],
    allowAutoShiftRoleIds: raw?.allowAutoShiftRoleIds ?? [],
    leaderboardChannelId: raw?.leaderboardChannelId ?? null,
    leaderboardMessageId: raw?.leaderboardMessageId ?? null,
    // sesli mesai rolleri
    shiftRoleId: raw?.shiftRoleId ?? null, // mesai boyunca verilen rol (girişte eklenir, çıkışta alınır)
    firstShiftRoleId: raw?.firstShiftRoleId ?? null, // ilk mesai girişinde verilen rol (ilk kayıt)
    legalRoleId: raw?.legalRoleId ?? null, // legal izni rolü (ilk mesai girişinde verilir)
    ...raw,
  };
}

export async function getShiftConfig(guildId) {
  return defaultConfig(await getSetting(guildId, 'shift.config'));
}

export async function setShiftConfig(guildId, patch) {
  const current = await getShiftConfig(guildId);
  const merged = { ...current, ...patch };
  await setSetting(guildId, 'shift.config', merged);
  return merged;
}

const VOICE_SESSIONS = 'voice_sessions';

export async function addAutoShiftVoiceChannel(guildId, channelId) {
  const cfg = await getShiftConfig(guildId);
  const channels = [...new Set([...(cfg.autoStartVoiceChannelIds || []), channelId])];
  return setShiftConfig(guildId, { autoStartVoiceChannelIds: channels });
}

export async function removeAutoShiftVoiceChannel(guildId, channelId) {
  const cfg = await getShiftConfig(guildId);
  return setShiftConfig(guildId, { autoStartVoiceChannelIds: (cfg.autoStartVoiceChannelIds || []).filter((x) => x !== channelId) });
}

export async function getAutoShiftVoiceChannels(guildId) {
  const cfg = await getShiftConfig(guildId);
  return cfg.autoStartVoiceChannelIds || [];
}

export async function shouldAutoStartShift(member) {
  const cfg = await getShiftConfig(member.guild.id);
  if (!Array.isArray(cfg.allowAutoShiftRoleIds) || cfg.allowAutoShiftRoleIds.length === 0) {
    return !member.user?.bot;
  }
  return cfg.allowAutoShiftRoleIds.some((r) => member.roles?.cache?.has?.(r));
}

export async function recordVoiceSession({ guildId, userId, channelId, action }) {
  const doc = { guild_id: guildId, user_id: userId, channel_id: channelId, action, at: nowIso() };
  await insertDoc(VOICE_SESSIONS, doc);
  return doc;
}

export async function closeOpenShiftsForInactive(guild, inactiveDays = 14) {
  const result = [];
  const members = await guild.members.fetch().catch(() => new Map());
  for (const [userId, member] of members) {
    if (member.user?.bot) continue;
    const rows = await findDocs(SHIFTS, { guild_id: guild.id, user_id: userId }, { sort: { started_at: -1 }, limit: 1 }).catch(() => []);
    const last = rows[0];
    if (last) continue;
    const onLeaveNow = await isOnLeave(guild.id, userId).catch(() => false);
    if (onLeaveNow) continue;
    result.push(userId);
  }
  return { days: inactiveDays, inactiveCandidates: result.slice(0, 50) };
}

export async function findActiveShift(guildId, userId) {
  return findOneDoc(SHIFTS, { guild_id: guildId, user_id: userId, status: 'aktif' });
}

async function findOpenShifts(guildId) {
  return findDocs(SHIFTS, { guild_id: guildId, status: 'aktif' }, { sort: { started_at: -1 }, limit: 1000 });
}

export async function startShift({ guild, member }) {
  const guildId = guild.id;
  const userId = member.id;
  const current = await findActiveShift(guildId, userId);
  if (current) return { ok: false, error: 'already_active', doc: current };

  const cfg = await getShiftConfig(guildId);
  let originalName = null;
  try { originalName = member.nickname ?? member.user?.username ?? null; } catch {}
  const doc = {
    shift_id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`,
    guild_id: guildId,
    user_id: userId,
    status: 'aktif',
    started_at: nowIso(),
    ended_at: null,
    duration_seconds: 0,
    adjusted_seconds: 0,
    close_reason: null,
    original_nickname: originalName,
    tolerance_minutes: cfg.toleranceMinutes,
    game_required: cfg.requireGame,
  };
  await insertDoc(SHIFTS, doc);

  // sesli mesai rolleri — mesai rolü her girişte; ilk/legal rolleri ilk mesai girişinde.
  try {
    const priorRows = await findDocs(SHIFTS, { guild_id: guildId, user_id: userId, status: 'bitti' }, { limit: 1 }).catch(() => []);
    const firstTime = priorRows.length === 0;
    const addIds = [];
    if (cfg.shiftRoleId) addIds.push(cfg.shiftRoleId);
    if (firstTime) {
      if (cfg.firstShiftRoleId) addIds.push(cfg.firstShiftRoleId);
      if (cfg.legalRoleId) addIds.push(cfg.legalRoleId);
    }
    const rolesAdded = [];
    for (const roleId of [...new Set(addIds)]) {
      if (!roleId || member.roles?.cache?.has?.(roleId)) continue;
      const ok = await member.roles
        ?.add?.(roleId, firstTime ? 'Ilk mesai girisi' : 'Mesai basladi')
        .then(() => true)
        .catch(() => false);
      if (ok) rolesAdded.push(roleId);
    }
    doc.first_shift = firstTime;
    doc.roles_added = rolesAdded;
    await updateDoc(SHIFTS, { guild_id: guildId, shift_id: doc.shift_id }, { first_shift: firstTime, roles_added: rolesAdded }).catch(() => {});
  } catch {}

  // nickname [M] — hata olursa shift'i bozma
  try {
    const prefix = String(cfg.prefix || '[M]').slice(0, 4);
    const base = String(originalName ?? member.user?.username ?? '').trim();
    const nick = `${prefix} ${base}`.trim().slice(0, 32);
    if (nick && member.manageable) await member.setNickname(nick).catch(() => {});
    doc.nickname_applied = true;
  } catch {}

  await setLeaderboardValue(guildId, 'last_change', nowIso()).catch(() => {});
  return { ok: true, doc };
}

export async function endShift({ guild, userId, reason = 'manual' }) {
  const doc = await findActiveShift(guild.id, userId);
  if (!doc) return { ok: false, error: 'not_active' };
  const cfg = await getShiftConfig(guild.id);
  const endedAt = nowIso();
  const started = new Date(doc.started_at).getTime();
  const rawSeconds = Math.max(0, (Date.now() - started) / 1000);
  const extra = Number(doc.adjusted_seconds || 0);
  const total = rawSeconds + extra;
  await updateDoc(SHIFTS, { guild_id: guild.id, shift_id: doc.shift_id }, {
    status: 'bitti',
    ended_at: endedAt,
    close_reason: reason,
    duration_seconds: Math.round(total),
  });
  const member = await guild.members.fetch(userId).catch(() => null);
  if (member?.manageable) {
    if (doc.original_nickname) await member.setNickname(doc.original_nickname).catch(() => {});
    else await member.setNickname(null).catch(() => {});
  }
  // mesai rolü çıkışta alınır (ilk kayıt / legal izni rolleri kalır).
  try {
    if (cfg.shiftRoleId && member && !member.user?.bot) {
      await member.roles?.remove?.(cfg.shiftRoleId, 'Mesai bitti').catch(() => {});
    }
  } catch {}
  return { ok: true, doc: await findOneDoc(SHIFTS, { guild_id: guild.id, shift_id: doc.shift_id }), durationSeconds: total };
}

export async function adjustShift(guildId, userId, deltaSeconds) {
  const doc = await findActiveShift(guildId, userId);
  if (doc) {
    await updateDoc(SHIFTS, { guild_id: guildId, shift_id: doc.shift_id }, { adjusted_seconds: (doc.adjusted_seconds || 0) + deltaSeconds });
    return { ok: true, active: true };
  }
  // pasif oturuma eklemek için en son bitmiş kaydi bul
  const sessions = await findDocs(SHIFTS, { guild_id: guildId, user_id: userId, status: 'bitti' }, { sort: { ended_at: -1 }, limit: 1 });
  const last = sessions[0];
  if (!last) return { ok: false, error: 'not_found' };
  const patchDuration = Math.max(0, (last.duration_seconds || 0) + deltaSeconds);
  await updateDoc(SHIFTS, { guild_id: guildId, shift_id: last.shift_id }, { duration_seconds: patchDuration });
  return { ok: true, active: false };
}

export async function resetShift(guildId, userId) {
  // sadece Biten oturumlari sifirlar; aktifse once bitir ? burada onay komutu sonrasi manuel.
  await deleteDocs(SHIFTS, { guild_id: guildId, user_id: userId, status: { $in: ['bitti', 'guncel'] } });
  return { ok: true };
}

export async function listActiveShifts(guildId) {
  return findOpenShifts(guildId);
}

export async function shiftTotalSeconds(guildId, userId = null, period = 'toplam') {
  const filter = { guild_id: guildId, status: { $in: ['bitti', 'aktif'] } };
  if (userId) filter.user_id = userId;
  const rows = await findDocs(SHIFTS, filter, { sort: { started_at: -1 }, limit: 5000 });
  const now = Date.now();
  return rows.reduce((sum, r) => {
    let total = Number(r.adjusted_seconds || 0);
    if (r.status === 'aktif') total += Math.max(0, (now - new Date(r.started_at).getTime()) / 1000);
    else total += Number(r.duration_seconds || 0);
    return sum + total;
  }, 0);
}

function withinPeriod(row, period) {
  if (period === 'toplam') return true;
  const date = new Date(row.started_at || 0);
  const day = new Date();
  if (period === 'gunluk') return date.toDateString() === day.toDateString();
  if (period === 'haftalik') {
    const diff = (day.getTime() - date.getTime()) / (86400000);
    return diff < 7;
  }
  if (period === 'aylik') return date.getMonth() === day.getMonth() && date.getFullYear() === day.getFullYear();
  return true;
}

export async function shiftLeaderboard(guildId, { period = 'toplam', limit = 20 } = {}) {
  const rows = await findDocs(SHIFTS, { guild_id: guildId }, { sort: { started_at: -1 }, limit: 10000 });
  const map = new Map();
  for (const row of rows) {
    if (!withinPeriod(row, period)) continue;
    let seconds = 0;
    if (row.status === 'aktif') seconds = (row.adjusted_seconds || 0) + Math.max(0, (Date.now() - new Date(row.started_at).getTime()) / 1000);
    else seconds = (row.duration_seconds || 0) + (row.adjusted_seconds || 0);
    if (!Number.isFinite(seconds) || seconds <= 0) continue;
    const u = row.user_id;
    map.set(u, (map.get(u) || 0) + seconds);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([userId, seconds]) => ({ userId, seconds, human: formatDuration(seconds) }));
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return [
    Math.floor(seconds / 3600) + ' sa',
    Math.floor((seconds % 3600) / 60) + ' dk',
    (seconds % 60) + ' sn',
  ].join(' ');
}

export async function setLeaderboardValue(guildId, key, value) {
  const cfg = await getShiftConfig(guildId);
  const data = cfg?.advanced ?? {};
  data[key] = value;
  await setSetting(guildId, 'shift.advanced', data);
  return data;
}

export async function createUnit({ guildId, name, leadId = null, note = null }) {
  const unitId = `birim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,4)}`;
  const doc = { unit_id: unitId, guild_id: guildId, name, lead_id: leadId, note, members: leadId ? [leadId] : [], created_at: nowIso(), active: true };
  await insertDoc(UNITS, doc);
  return doc;
}

export async function listUnits(guildId, { active = true } = {}) {
  const filter = { guild_id: guildId };
  if (typeof active === 'boolean') filter.active = active;
  return findDocs(UNITS, filter, { sort: { created_at: -1 }, limit: 100 });
}

export async function getUnit(guildId, unitId) {
  return findOneDoc(UNITS, { guild_id: guildId, unit_id: unitId });
}

export async function addUnitMember(guildId, unitId, userId) {
  const doc = await getUnit(guildId, unitId);
  if (!doc) return false;
  if (!(doc.members ?? []).includes(userId)) (doc.members ??= []).push(userId);
  await updateDoc(UNITS, { guild_id: guildId, unit_id: unitId }, { members: doc.members });
  return true;
}

export async function removeUnitMember(guildId, unitId, userId) {
  const doc = await getUnit(guildId, unitId);
  if (!doc) return false;
  const next = (doc.members ?? []).filter((u) => u !== userId);
  await updateDoc(UNITS, { guild_id: guildId, unit_id: unitId }, { members: next });
  return true;
}

export async function updateUnitNote(guildId, unitId, note) {
  await updateDoc(UNITS, { guild_id: guildId, unit_id: unitId }, { note });
  return true;
}

export async function deactivateUnit(guildId, unitId) {
  await updateDoc(UNITS, { guild_id: guildId, unit_id: unitId }, { active: false });
  return true;
}

export async function createLeaveRequest({ guildId, userId, start, end, reason }) {
  const doc = {
    leave_id: `leave-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,4)}`,
    guild_id: guildId,
    user_id: userId,
    start,
    end,
    reason,
    status: 'beklemede',
    created_at: nowIso(),
    reviewed_by: null,
    reviewed_at: null,
  };
  await insertDoc(LEAVES, doc);
  return doc;
}

export async function reviewLeave({ guildId, leaveId, reviewerId, approve }) {
  const doc = await findOneDoc(LEAVES, { guild_id: guildId, leave_id: leaveId });
  if (!doc) return false;
  if (doc.status !== 'beklemede') return false;
  await updateDoc(LEAVES, { guild_id: guildId, leave_id: leaveId }, {
    status: approve ? 'onaylandi' : 'reddedildi',
    reviewed_by: reviewerId,
    reviewed_at: nowIso(),
  });
  return true;
}

export async function listLeaves(guildId, { status = null, userId = null, limit = 50 } = {}) {
  const filter = { guild_id: guildId };
  if (status) filter.status = status;
  if (userId) filter.user_id = userId;
  return findDocs(LEAVES, filter, { sort: { created_at: -1 }, limit });
}

export async function isOnLeave(guildId, userId, now = new Date()) {
  const rows = await findDocs(LEAVES, { guild_id: guildId, user_id: userId, status: 'onaylandi' }, { limit: 200 });
  return rows.some((r) => new Date(r.start) <= now && now <= new Date(r.end));
}

const activeTimeouts = new Map();

export function scheduleVoiceTolerance({ client, guildId, userId, member }) {
  const timeoutMs = (async () => {
    const cfg = await getShiftConfig(guildId);
    return Math.max(30_000, Number(cfg.toleranceMinutes ?? 2) * 60000);
  })();
  const existing = activeTimeouts.get(`${guildId}:${userId}`);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(async () => {
    activeTimeouts.delete(`${guildId}:${userId}`);
    const row = await findActiveShift(guildId, userId);
    if (!row) return;
    const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
    if (guild) await endShift({ guild, userId, reason: 'ses_disi_tol' }).catch(() => {});
  }, 30000);
  timeoutMs.then((t) => {
    if (activeTimeouts.get(`${guildId}:${userId}`) !== timer) return;
    clearTimeout(timer);
    const timer2 = setTimeout(async () => {
      activeTimeouts.delete(`${guildId}:${userId}`);
      const row = await findActiveShift(guildId, userId);
      if (!row) return;
      const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
      if (guild) await endShift({ guild, userId, reason: 'ses_disi_tol' }).catch(() => {});
    }, t);
    activeTimeouts.set(`${guildId}:${userId}`, timer2);
  }).catch(() => {});
  activeTimeouts.set(`${guildId}:${userId}`, timer);
}

export function cancelVoiceTolerance(guildId, userId) {
  const timer = activeTimeouts.get(`${guildId}:${userId}`);
  if (timer) clearTimeout(timer);
  activeTimeouts.delete(`${guildId}:${userId}`);
}

const GAMESTATE_PROVIDER = { source: 'disabled', available: false };
export function configureGameStateProvider(provider) {
  if (provider && typeof provider.query === 'function') {
    Object.assign(GAMESTATE_PROVIDER, provider, { available: true });
  }
}
export function getGameStateProvider() { return { ...GAMESTATE_PROVIDER }; }
export async function queryGameState(userId) {
  if (!GAMESTATE_PROVIDER.available) return { available: false, status: 'unknown' };
  try { return await GAMESTATE_PROVIDER.query(userId); } catch { return { available: false, status: 'error' } }
}

export async function createActivityTest({ guildId, testId, roleId, durationMinutes, channelId, messageId }) {
  const now = new Date();
  const doc = {
    test_id: testId,
    guild_id: guildId,
    role_id: roleId,
    duration_minutes: Number(durationMinutes),
    channel_id: channelId,
    message_id: messageId,
    created_at: nowIso(),
    ends_at: new Date(now.getTime() + Number(durationMinutes)*60000).toISOString(),
    status: 'aktif',
    clicked: [],
    exempt: [],
  };
  await insertDoc(ACTIVITY_TESTS, doc);
  return doc;
}

export async function recordActivityClick(guildId, testId, userId) {
  const doc = await findOneDoc(ACTIVITY_TESTS, { guild_id: guildId, test_id: testId, status: 'aktif' });
  if (!doc) return false;
  if (!(doc.clicked ?? []).includes(userId)) {
    doc.clicked ??= [];
    doc.clicked.push(userId);
    await updateDoc(ACTIVITY_TESTS, { guild_id: guildId, test_id: testId }, { clicked: doc.clicked });
  }
  return true;
}

export async function finalizeActivityTest(client, guildId, testId) {
  const doc = await findOneDoc(ACTIVITY_TESTS, { guild_id: guildId, test_id: testId });
  if (!doc || doc.status !== 'aktif') return false;
  await updateDoc(ACTIVITY_TESTS, { guild_id: guildId, test_id: testId }, { status: 'tamamlandi', finalized_at: nowIso() });
  const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild || !doc.role_id) return true;
  const members = (await guild.members.fetch().catch(() => null)) ?? new Map();
  const clicked = new Set(doc.clicked ?? []);
  for (const [id, member] of members) {
    if (!member.roles?.cache?.has?.(doc.role_id)) continue;
    if (clicked.has(id)) continue;
    // mazeretli olanlar muaf
    if (await isOnLeave(guildId, id).catch(() => false)) continue;
    await member.roles.remove(doc.role_id, 'Aktiflik testi: katilim belirtilmedi').catch(() => {});
  }
  return true;
}

export async function getActiveActivityTests(guildId) {
  return findDocs(ACTIVITY_TESTS, { guild_id: guildId, status: 'aktif' }, { sort: { created_at: -1 }, limit: 100 });
}
