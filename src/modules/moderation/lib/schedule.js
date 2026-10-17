/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../../db/index.js';
import { createBullConnection, isRedisReady } from '../../../core/redis.js';

const handlers = new Map();
const MEM = { tasks: [] };
const MEM_CAP = 1000;
let timer = null;
let queue = null;
let worker = null;
let redisUrl = null;
let loggerRef = null;

export function registerTaskHandler(kind, fn) {
  handlers.set(kind, fn);
}

export function clearTaskHandlers() {
  handlers.clear();
}

/** Test izolasyonu. */
export function clearScheduleMemory() {
  MEM.tasks.length = 0;
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {{guildId?: string|null, kind: string, runAt: Date|string|number, payload?: object, taskId?: string|null}} input
 */
export async function scheduleTask({ guildId = null, kind, runAt, payload = {}, taskId = null }) {
  const runAtIso = runAt instanceof Date ? runAt.toISOString() : new Date(runAt).toISOString();
  const doc = {
    task_id: taskId ?? `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    guild_id: guildId,
    kind,
    payload,
    run_at: runAtIso,
    status: 'pending',
    attempts: 0,
    created_at: nowIso(),
    started_at: null,
    done_at: null,
    error: null,
  };

  if (isDbReady()) {
    await getCollection('timed_tasks').insertOne({ ...doc });
  } else {
    MEM.tasks.unshift(doc);
    if (MEM.tasks.length > MEM_CAP) MEM.tasks.length = MEM_CAP;
  }

  await enqueueBull(doc).catch(() => {});
  return doc;
}

export async function cancelTask(taskId) {
  if (!taskId) return false;
  if (isDbReady()) {
    const result = await getCollection('timed_tasks').updateOne(
      { task_id: taskId, status: 'pending' },
      { $set: { status: 'cancelled', done_at: nowIso() } },
    );
    return result.modifiedCount > 0;
  }
  const doc = MEM.tasks.find((item) => item.task_id === taskId && item.status === 'pending');
  if (!doc) return false;
  doc.status = 'cancelled';
  doc.done_at = nowIso();
  return true;
}

export async function listPendingTasks(guildId, kind = null) {
  const filter = { guild_id: guildId, status: 'pending' };
  if (kind) filter.kind = kind;
  if (isDbReady()) {
    return getCollection('timed_tasks').find(filter).sort({ run_at: 1 }).limit(100).toArray();
  }
  return MEM.tasks
    .filter((doc) => doc.guild_id === guildId && doc.status === 'pending' && (!kind || doc.kind === kind))
    .sort((a, b) => String(a.run_at).localeCompare(String(b.run_at)))
    .slice(0, 100);
}

async function finishTask(task, patch) {
  const update = { ...patch, done_at: nowIso() };
  if (isDbReady()) {
    await getCollection('timed_tasks').updateOne({ task_id: task.task_id }, { $set: update });
    return;
  }
  Object.assign(task, update);
}

/** Gorevi sahiplenip calistirir; sahiplenemezse false. */
export async function runTaskById(taskId) {
  if (!taskId) return false;
  let task = null;

  if (isDbReady()) {
    const result = await getCollection('timed_tasks').findOneAndUpdate(
      { task_id: taskId, status: 'pending' },
      { $set: { status: 'running', started_at: nowIso() } },
    );
    task = result?.value ?? result ?? null;
  } else {
    const doc = MEM.tasks.find((item) => item.task_id === taskId && item.status === 'pending');
    if (doc) {
      doc.status = 'running';
      doc.started_at = nowIso();
      task = doc;
    }
  }
  if (!task) return false;

  const handler = handlers.get(task.kind);
  try {
    if (handler) await handler(task.payload ?? {}, task);
    await finishTask(task, { status: 'done' });
    loggerRef?.info?.({ taskId: task.task_id, kind: task.kind }, 'Zamanlanmis gorev tamamlandi');
    return true;
  } catch (error) {
    const attempts = (task.attempts ?? 0) + 1;
    const errorText = String(error?.message ?? error);
    if (attempts >= 3) {
      await finishTask(task, { status: 'failed', attempts, error: errorText });
      loggerRef?.warn?.({ taskId: task.task_id, kind: task.kind, error: errorText }, 'Zamanlanmis gorev basarisiz');
      return false;
    }
    const retryAt = new Date(Date.now() + 120_000).toISOString();
    const patch = { status: 'pending', attempts, run_at: retryAt, error: errorText };
    if (isDbReady()) {
      await getCollection('timed_tasks').updateOne({ task_id: task.task_id }, { $set: patch });
    } else {
      Object.assign(task, patch);
    }
    return false;
  }
}

/** Suresi gelen gorevleri isler; islenen sayisini doner. */
export async function runDueTasks({ limit = 50, now = new Date() } = {}) {
  const nowIsoStr = now.toISOString();
  let due;
  if (isDbReady()) {
    due = await getCollection('timed_tasks')
      .find({ status: 'pending', run_at: { $lte: nowIsoStr } })
      .sort({ run_at: 1 })
      .limit(limit)
      .toArray();
  } else {
    due = MEM.tasks
      .filter((task) => task.status === 'pending' && String(task.run_at) <= nowIsoStr)
      .sort((a, b) => String(a.run_at).localeCompare(String(b.run_at)))
      .slice(0, limit);
  }

  let processed = 0;
  for (const task of due) {
    if (await runTaskById(task.task_id)) processed += 1;
  }
  return processed;
}

// ---------------------------------------------------------------------------
// BullMQ hizlandirici (opsiyonel: Redis + url gerekir)
// ---------------------------------------------------------------------------

async function getQueue() {
  if (queue) return queue;
  if (!isRedisReady() || !redisUrl) return null;
  try {
    const { Queue } = await import('bullmq');
    queue = new Queue('timed-tasks', { connection: createBullConnection({ url: redisUrl }) });
    queue.on?.('error', () => {});
    return queue;
  } catch {
    queue = null;
    return null;
  }
}

async function enqueueBull(doc) {
  const q = await getQueue();
  if (!q) return;
  const delay = Math.max(0, new Date(doc.run_at).getTime() - Date.now());
  await q.add(
    'task',
    { taskId: doc.task_id },
    { delay, jobId: doc.task_id, removeOnComplete: true, removeOnFail: true, attempts: 1 },
  );
}

/**
 * Tarayiciyi ve (varsa) BullMQ worker'ini baslatir.
 * @param {{url?: string|null, logger?: object|null, tickMs?: number}} opts
 */
export async function startScheduler({ url = null, logger = null, tickMs = 30_000 } = {}) {
  redisUrl = url ?? redisUrl;
  loggerRef = logger ?? loggerRef;
  if (timer) return;

  timer = setInterval(() => {
    runDueTasks().catch(() => {});
  }, tickMs);
  timer.unref?.();
  runDueTasks().catch(() => {});

  if (isRedisReady() && redisUrl) {
    try {
      const { Worker } = await import('bullmq');
      worker = new Worker(
        'timed-tasks',
        async (job) => {
          await runTaskById(job?.data?.taskId);
        },
        { connection: createBullConnection({ url: redisUrl }) },
      );
      worker.on('error', () => {});
    } catch {
      worker = null;
    }
  }
  loggerRef?.info?.('Zamanlayici hazır (timed_tasks)');
}

export async function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (worker) {
    try {
      await worker.close();
    } catch {
      /* yut */
    }
    worker = null;
  }
  if (queue) {
    try {
      await queue.close();
    } catch {
      /* yut */
    }
    queue = null;
  }
}
