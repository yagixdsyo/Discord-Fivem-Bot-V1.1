/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { Queue, Worker } from 'bullmq';
import { getLogger } from '../../../core/logger.js';
import { createBullConnection, isRedisReady } from '../../../core/redis.js';
import { createTranslator } from '../../../locales/index.js';
import { card } from '../../../ui/templates/base.js';
import { progress } from '../../../ui/templates/index.js';
import { button, row } from '../../../ui/v2.js';
import { findDocs, findOneDoc, insertDoc, updateDoc } from '../../fivem/lib/store.js';
import { getSetting } from '../../fivem/lib/state.js';
import { getRoleId } from '../../fivem/lib/maps.js';

const LOGS = 'dm_logs';
const QUEUE_NAME = 'dm-announce';
const RATE_MS = 1200;
const JITTER_MS = 800;
const FIRST_DAYS = 15;
const LIMIT_KEY = 'announce.dm.limit';

export const STAFF_ROLE_KEYS = Object.freeze([
  'yonetici',
  'ust_yetkili',
  'moderator',
  'yetkili',
  'destek',
  'ban_yetkilisi',
  'mulakatci',
  'kayit_yetkilisi',
]);

let queue = null;
let worker = null;
let clientRef = null;

export function registerAnnounceJobs(client) {
  clientRef = client;
}

export async function startAnnounceWorker({ url, logger = getLogger() } = {}) {
  if (!url) return false;
  if (!isRedisReady()) {
    logger.warn('Redis yok: DM duyuru kuyrugu (BullMQ) devre disi; gonderim surec ici yapilir.');
    return false;
  }
  try {
    queue = new Queue(QUEUE_NAME, { connection: createBullConnection({ url }) });
    worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        await runDmJob(job.data);
      },
      { connection: createBullConnection({ url }), concurrency: 1 },
    );
    worker.on('failed', (job, err) => logger.warn({ job: job?.id, err: err?.message }, 'DM duyuru isi basarisiz'));
    logger.info('DM duyuru kuyrugu (BullMQ) hazir');
    return true;
  } catch (err) {
    logger.warn({ err: err?.message }, 'DM duyuru kuyrugu baslatilamadi; surec ici gonderim kullanilacak');
    return false;
  }
}

export async function stopAnnounceWorker() {
  await worker?.close().catch(() => {});
  await queue?.close().catch(() => {});
  worker = null;
  queue = null;
}

/** Test izolasyonu. */
export function setAnnounceClient(client) {
  clientRef = client;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter() {
  return Math.floor(Math.random() * JITTER_MS);
}

export function dmCard(t, { message, senderTag, guildName, sourceLabel = null }) {
  const lines = [String(message ?? '').slice(0, 1800)];
  lines.push(t('announce.dm.from', { kisi: senderTag ?? '-', sunucu: guildName ?? '-' }));
  if (sourceLabel) lines.push(t('announce.dm.source', { kaynak: sourceLabel }));
  return card({ emojiKey: 'DM', title: t('announce.dm.title'), lines, accent: 'info' });
}

function progressPayload(t, { sent, failed, total, senderTag, stopped = false, jobId, note = null }) {
  const done = stopped || sent + failed >= total;
  const buttons = done
    ? []
    : [row([button({ id: `dmduyuru:durdur:${jobId}`, label: t('announce.dm.stop'), emojiKey: 'RED', style: 'danger' })])];
  const lines = [
    t('announce.dm.progress_line', {
      gonderildi: `**${sent}**`,
      basarisiz: `**${failed}**`,
      toplam: total,
    }),
  ];
  if (note) lines.push(note);
  return progress({
    title: t('announce.dm.progress_title'),
    done: sent + failed,
    total,
    statusText: lines.join('\n'),
    footer: senderTag ?? null,
    buttons,
    accent: 'primary',
    emojiKey: done ? 'BASARI' : 'YUKLENIYOR',
  });
}

export { progressPayload };

/** Yetkili rollerinin ID'leri (roller_map uzerinden). */
export async function staffRoleIds(guild) {
  const ids = [];
  for (const key of STAFF_ROLE_KEYS) {
    const id = await getRoleId(guild.id, key);
    if (id) ids.push(id);
  }
  return ids;
}

/**
 * Hedef uye ID'lerini toplar.
 * @param {{source: 'yetkili'|'rol'|'kisi'|'oyuncu', roleId?: string, userIds?: string[]}} opts
 */
export async function collectTargets(guild, { source, roleId = null, userIds = [] }) {
  if (source === 'kisi') {
    const valid = [];
    for (const id of userIds) {
      const member = guild.members.cache.get(id) ?? (await guild.members.fetch(id).catch(() => null));
      if (member && !member.user.bot) valid.push(member.id);
    }
    return valid;
  }

  let roleIds = [];
  if (source === 'yetkili') roleIds = await staffRoleIds(guild);
  else if (source === 'rol' && roleId) roleIds = [roleId];
  else if (source === 'oyuncu') {
    const whitelist = await getRoleId(guild.id, 'whitelist');
    roleIds = whitelist ? [whitelist] : [];
  }

  const ids = new Set();
  for (const member of guild.members.cache.values()) {
    if (member.user.bot) continue;
    if (source === 'oyuncu' && roleIds.length === 0) {
      ids.add(member.id);
      continue;
    }
    if (roleIds.some((id) => member.roles.cache.has(id))) ids.add(member.id);
  }

  if (ids.size === 0) {
    try {
      const fetched = await guild.members.fetch();
      for (const member of fetched.values()) {
        if (member.user.bot) continue;
        if (roleIds.length === 0 || roleIds.some((id) => member.roles.cache.has(id))) ids.add(member.id);
      }
    } catch {
      /* fetch kapali */
    }
  }

  return [...ids];
}

/** Gunluk DM limiti: ilk 15 gun dusuk, sonra yuksek (ayarlanabilir). */
export async function getDailyLimit(guild) {
  const raw = await getSetting(guild.id, LIMIT_KEY);
  const joinedMs = guild.members?.me?.joinedTimestamp ?? guild.joinedTimestamp ?? Date.now();
  const newBot = Date.now() - joinedMs < FIRST_DAYS * 86_400_000;
  const fallback = newBot ? 50 : 300;
  const value = Number(raw?.value) || fallback;
  return { limit: Math.max(10, Math.min(2000, value)), newBot, fallback: newBot ? 50 : 300 };
}

export async function dmUsageToday(guildId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = await findDocs(
    LOGS,
    { guild_id: guildId, kind: 'kayit', status: 'gonderildi', created_at: { $gte: start.toISOString() } },
    { limit: 5000 },
  );
  return rows.length;
}

/**
 * DM duyuru isini baslatir; bilgi kartini dondurur.
 * @returns {Promise<{jobId: string, total: number, trimmed: number}>}
 */
export async function startDmAnnounce({ guild, sender, targets, message, sourceLabel, channelId, messageId }) {
  const jobId = `dm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const jobData = {
    jobId,
    guildId: guild.id,
    targets,
    message: String(message).slice(0, 1800),
    senderId: sender.id,
    senderTag: sender.tag ?? sender.username ?? sender.id,
    sourceLabel: sourceLabel ?? null,
    channelId: channelId ?? null,
    messageId: messageId ?? null,
  };

  await insertDoc(LOGS, {
    job_id: jobId,
    kind: 'meta',
    guild_id: guild.id,
    sender_id: sender.id,
    sender_tag: jobData.senderTag,
    message: jobData.message,
    source: sourceLabel ?? null,
    total: targets.length,
    sent: 0,
    failed: 0,
    status: 'isliyor',
    stop: false,
    channel_id: channelId ?? null,
    message_id: messageId ?? null,
  });

  if (queue) {
    await queue.add('run', jobData, { jobId, attempts: 1, removeOnComplete: true, removeOnFail: 200 });
  } else {
    setImmediate(() => {
      runDmJob(jobData).catch((err) => getLogger().warn({ err: err?.message, jobId }, 'DM duyuru isi hatasi'));
    });
  }

  return { jobId, total: targets.length };
}

/** Isi yurutur (worker veya surec ici). */
export async function runDmJob(data) {
  const t = createTranslator();
  const { jobId, guildId, targets, message, senderTag, sourceLabel, channelId, messageId } = data;

  const guild = clientRef?.guilds?.cache?.get(guildId) ?? (await clientRef?.guilds?.fetch(guildId).catch(() => null));
  if (!guild) {
    await updateDoc(LOGS, { job_id: jobId, kind: 'meta' }, { status: 'hata', error: 'sunucu_yok' });
    return;
  }

  const channel = channelId
    ? guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null))
    : null;
  const progressMsg = channel && messageId ? await channel.messages.fetch(messageId).catch(() => null) : null;

  let sent = 0;
  let failed = 0;
  let stopped = false;

  for (const userId of targets) {
    const meta = await findOneDoc(LOGS, { job_id: jobId, kind: 'meta' });
    if (meta?.stop) {
      stopped = true;
      break;
    }

    const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null));
    if (!member) {
      failed += 1;
      await insertDoc(LOGS, { job_id: jobId, guild_id: guildId, kind: 'kayit', target_id: userId, status: 'uye_yok' });
    } else {
      const payload = dmCard(t, { message, senderTag, guildName: guild.name, sourceLabel });
      let ok = false;
      let error = null;
      try {
        await member.send(payload);
        ok = true;
      } catch (err) {
        error = String(err?.code ?? err?.message ?? err).slice(0, 120);
      }
      if (ok) {
        sent += 1;
        await insertDoc(LOGS, { job_id: jobId, guild_id: guildId, kind: 'kayit', target_id: userId, status: 'gonderildi' });
      } else {
        failed += 1;
        await insertDoc(LOGS, {
          job_id: jobId,
          guild_id: guildId,
          kind: 'kayit',
          target_id: userId,
          status: 'basarisiz',
          error,
        });
      }
    }

    await updateDoc(LOGS, { job_id: jobId, kind: 'meta' }, { sent, failed });
    if ((sent + failed) % 10 === 0 || sent + failed === targets.length) {
      await progressMsg?.edit(progressPayload(t, { sent, failed, total: targets.length, senderTag, jobId })).catch(() => {});
    }

    await sleep(RATE_MS + jitter());
  }

  const failedRows = await findDocs(LOGS, { job_id: jobId, kind: 'kayit', status: { $ne: 'gonderildi' } }, { limit: 1000 });
  const files = [];
  if (failedRows.length > 0) {
    const body = failedRows.map((row) => `${row.target_id}\t${row.status}\t${row.error ?? ''}`).join('\n');
    files.push(new AttachmentBuilder(Buffer.from(body, 'utf8'), { name: `${jobId}-basarisiz.txt` }));
  }

  await updateDoc(LOGS, { job_id: jobId, kind: 'meta' }, { status: stopped ? 'durduruldu' : 'bitti', sent, failed });

  const finalPayload = progressPayload(t, { sent, failed, total: targets.length, senderTag, stopped, jobId });
  if (files.length > 0) finalPayload.files = files;
  await progressMsg?.edit(finalPayload).catch(() => {});
}

/** Durdurma butonu: meta.stop = true. */
export async function requestStop(guildId, jobId) {
  const meta = await findOneDoc(LOGS, { job_id: jobId, kind: 'meta', guild_id: guildId });
  if (!meta) return false;
  if (meta.status !== 'isliyor') return false;
  await updateDoc(LOGS, { job_id: jobId, kind: 'meta' }, { stop: true });
  return true;
}
