/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  scheduleTask,
  cancelTask,
  listPendingTasks,
  runTaskById,
  runDueTasks,
  registerTaskHandler,
  clearTaskHandlers,
  clearScheduleMemory,
} from '../src/modules/moderation/lib/schedule.js';

afterEach(() => {
  clearScheduleMemory();
  clearTaskHandlers();
});

describe('schedule/scheduleTask', () => {
  it('pending gorev olusturur ve listeler', async () => {
    const task = await scheduleTask({
      guildId: 'g1',
      kind: 'unban',
      runAt: new Date(Date.now() + 60_000),
      payload: { userId: 'u1' },
    });

    expect(task.task_id).toMatch(/^t-/);
    expect(task.status).toBe('pending');

    const pending = await listPendingTasks('g1', 'unban');
    expect(pending).toHaveLength(1);
    expect(pending[0].payload.userId).toBe('u1');
  });
});

describe('schedule/runTaskById', () => {
  it('gorevi bir kez sahiplenip calistirir (ikinci cagri false)', async () => {
    let calls = 0;
    registerTaskHandler('t_once', async () => {
      calls += 1;
    });

    const task = await scheduleTask({ guildId: 'g1', kind: 't_once', runAt: new Date(), payload: {} });

    expect(await runTaskById(task.task_id)).toBe(true);
    expect(await runTaskById(task.task_id)).toBe(false);
    expect(calls).toBe(1);
    expect(await listPendingTasks('g1', 't_once')).toHaveLength(0);
  });

  it('handler yoksa gorev yine de tamamlanir', async () => {
    const task = await scheduleTask({ guildId: 'g1', kind: 't_yok', runAt: new Date(), payload: {} });
    expect(await runTaskById(task.task_id)).toBe(true);
    expect(await listPendingTasks('g1', 't_yok')).toHaveLength(0);
  });

  it('hata sonrasi gorev yeniden pending olur (attempts artar)', async () => {
    registerTaskHandler('t_fail', async () => {
      throw new Error('patladı');
    });

    const task = await scheduleTask({ guildId: 'g1', kind: 't_fail', runAt: new Date(), payload: {} });
    expect(await runTaskById(task.task_id)).toBe(false);

    const pending = await listPendingTasks('g1', 't_fail');
    expect(pending).toHaveLength(1);
    expect(pending[0].attempts).toBe(1);
    expect(pending[0].error).toContain('patladı');
  });
});

describe('schedule/cancelTask', () => {
  it('pending gorevi iptal eder; calistirilamaz', async () => {
    let calls = 0;
    registerTaskHandler('t_cancel', async () => {
      calls += 1;
    });

    const task = await scheduleTask({ guildId: 'g1', kind: 't_cancel', runAt: new Date(Date.now() + 60_000), payload: {} });
    expect(await cancelTask(task.task_id)).toBe(true);
    expect(await cancelTask(task.task_id)).toBe(false);
    expect(await runTaskById(task.task_id)).toBe(false);
    expect(calls).toBe(0);
  });
});

describe('schedule/runDueTasks', () => {
  it('suresi gelen gorevleri calistirir', async () => {
    let calls = 0;
    registerTaskHandler('t_due', async () => {
      calls += 1;
    });

    await scheduleTask({ guildId: 'g1', kind: 't_due', runAt: new Date(Date.now() - 1000), payload: {} });
    await scheduleTask({ guildId: 'g1', kind: 't_due', runAt: new Date(Date.now() + 3_600_000), payload: {} });

    await runDueTasks({ now: new Date() });
    expect(calls).toBe(1);
    expect(await listPendingTasks('g1', 't_due')).toHaveLength(1);
  });
});
