/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { insertDoc, findDocs, findOneDoc, updateDoc } from '../../fivem/lib/store.js';

const COL = 'tasks';
const EVENTS = 'task_events';

export async function createTask({ guildId, title, description = null, createdBy, kind = 'genel' }) {
  const task = { task_id: `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,4)}`, guild_id: guildId, title, description, kind, status: 'acik', assigned_to: [], assigned_by: null, approval_by: null, note: null, evidence: null, created_by: createdBy, created_at: new Date().toISOString(), completed_at: null };
  await insertDoc(COL, task);
  return task;
}

export async function getTask(guildId, taskId) {
  return findOneDoc(COL, { guild_id: guildId, task_id: taskId });
}

export async function listTasks(guildId, { status = null } = {}) {
  const filter = { guild_id: guildId };
  if (status) filter.status = status;
  return findDocs(COL, filter, { sort: { created_at: -1 }, limit: 100 });
}

export async function assignTask({ guildId, taskId, assigneeId, actorId, reason = null }) {
  const task = await getTask(guildId, taskId);
  if (!task || task.status === 'tamamlandi' || task.status === 'reddedildi') return { ok: false, error: 'task_unavailable' };
  if ((task.assigned_to ?? []).includes(assigneeId)) return { ok: false, error: 'already_assigned' };
  const next = [...(task.assigned_to ?? []), assigneeId];
  await updateDoc(COL, { guild_id: guildId, task_id: taskId }, { assigned_to: next, assigned_by: actorId, status: 'atandi', reason });
  await insertDoc(EVENTS, { guild_id: guildId, task_id: taskId, event: 'assign', actor: actorId, assignee: assigneeId, at: new Date().toISOString(), reason });
  return { ok: true, next };
}

export async function submitTask({ guildId, taskId, userId, evidence = null, note = null }) {
  const task = await getTask(guildId, taskId);
  if (!task || !(task.assigned_to ?? []).includes(userId)) return { ok: false, error: 'not_assigned' };
  await updateDoc(COL, { guild_id: guildId, task_id: taskId }, { status: 'teslim_edildi', evidence, note, submitted_at: new Date().toISOString(), submitted_by: userId });
  await insertDoc(EVENTS, { guild_id: guildId, task_id: taskId, event: 'submit', actor: userId, at: new Date().toISOString() });
  return { ok: true };
}

export async function approveTask({ guildId, taskId, reviewerId }) {
  const task = await getTask(guildId, taskId);
  if (!task || task.status !== 'teslim_edildi') return { ok: false, error: 'task_not_submitted' };
  await updateDoc(COL, { guild_id: guildId, task_id: taskId }, { status: 'tamamlandi', approval_by: reviewerId, completed_at: new Date().toISOString() });
  await insertDoc(EVENTS, { guild_id: guildId, task_id: taskId, event: 'approve', actor: reviewerId, at: new Date().toISOString() });
  return { ok: true };
}

export async function rejectTask({ guildId, taskId, reviewerId, reason = null }) {
  const task = await getTask(guildId, taskId);
  if (!task) return { ok: false, error: 'task_missing' };
  await updateDoc(COL, { guild_id: guildId, task_id: taskId }, { status: 'acik', assigned_to: [], evidence: null, note: null, rejected_by: reviewerId, reject_reason: reason, rejected_at: new Date().toISOString() });
  await insertDoc(EVENTS, { guild_id: guildId, task_id: taskId, event: 'reject', actor: reviewerId, reason, at: new Date().toISOString() });
  return { ok: true };
}

export async function workload(guildId) {
  const tasks = await listTasks(guildId, {});
  const counts = new Map();
  for (const t of tasks) if (t.status !== 'tamamlandi' && t.status !== 'reddedildi') for (const u of (t.assigned_to ?? [])) counts.set(u, (counts.get(u) ?? 0) + 1);
  return [...counts.entries()].map(([userId, count]) => ({ userId, count })).sort((a,b)=>b.count-a.count);
}