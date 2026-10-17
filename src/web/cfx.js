/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { z } from 'zod';
import { getLogger } from '../core/logger.js';
import { getCfx } from '../modules/fivem/lib/state.js';
import { emitLog } from '../modules/logging/lib/emit.js';
import { recordPlayerJoin, recordPlayerLeave } from '../modules/fivem/lib/presence.js';

let server = null;

const rate = new Map(); // `${guildId}:${ip}` -> {count, windowStart}
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const MAX_BODY = 64 * 1024;
const MAX_SKEW_MS = 5 * 60_000;

const EVENT_LABELS = {
  giris: 'Oyuncu Girisi',
  cikis: 'Oyuncu Cikisi',
  ban: 'Ban',
  unban: 'Unban',
  olum: 'Olum',
  diger: 'Olay',
};

const bodySchema = z.object({
  type: z.enum(['giris', 'cikis', 'ban', 'unban', 'olum', 'diger']).default('diger'),
  player: z
    .object({
      id: z.union([z.string().max(50), z.number()]).optional(),
      name: z.string().max(100).optional(),
      identifiers: z.array(z.string().max(120)).max(10).optional(),
    })
    .optional(),
  reason: z.string().max(500).optional(),
  data: z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean()])).optional(),
});

export function clearWebhookRate() {
  rate.clear();
}

function checkRate(guildId, ip) {
  const key = `${guildId}:${ip}`;
  const now = Date.now();
  const hit = rate.get(key);
  if (!hit || now - hit.windowStart >= RATE_WINDOW_MS) {
    rate.set(key, { count: 1, windowStart: now });
    return true;
  }
  hit.count += 1;
  return hit.count <= RATE_LIMIT;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('buyuk'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function labelsLines(parsed) {
  const lines = [];
  if (parsed.player?.name) lines.push(`Oyuncu: **${parsed.player.name}**`);
  if (parsed.player?.id !== undefined) lines.push(`Sunucu ID: \`${parsed.player.id}\``);
  if (parsed.player?.identifiers?.length) lines.push(`Kimlik: ${parsed.player.identifiers.map((i) => `\`${i}\``).join(', ')}`);
  if (parsed.reason) lines.push(`Sebep: ${parsed.reason}`);
  for (const [key, value] of Object.entries(parsed.data ?? {})) {
    lines.push(`${key}: \`${String(value)}\``);
  }
  return lines.slice(0, 20);
}

async function handleRequest(req, res, client) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const match = /^\/cfx\/(\d{5,25})$/.exec(url.pathname);
  if (req.method !== 'POST' || !match) {
    json(res, 404, { error: 'not_found' });
    return;
  }

  const guildId = match[1];
  const cfx = await getCfx(guildId).catch(() => null);
  if (!cfx?.secret) {
    json(res, 403, { error: 'secret_yok' });
    return;
  }

  const raw = await readBody(req).catch(() => null);
  if (raw === null) {
    json(res, 413, { error: 'govde_buyuk' });
    return;
  }

  const signature = String(req.headers['x-signature'] ?? '');
  const expected = crypto.createHmac('sha256', cfx.secret).update(raw).digest('hex');
  const sigOk =
    signature.length === expected.length &&
    (() => {
      try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      } catch {
        return false;
      }
    })();
  if (!sigOk) {
    json(res, 401, { error: 'imza_gecersiz' });
    return;
  }

  const timestamp = Number(req.headers['x-timestamp'] ?? 0);
  if (!timestamp || Math.abs(Date.now() - timestamp) > MAX_SKEW_MS) {
    json(res, 401, { error: 'zaman_gecersiz' });
    return;
  }

  const ip = req.socket?.remoteAddress ?? 'bilinmiyor';
  if (!checkRate(guildId, ip)) {
    json(res, 429, { error: 'cok_fazla_istek' });
    return;
  }

  let parsed;
  try {
    parsed = bodySchema.parse(JSON.parse(raw));
  } catch {
    json(res, 400, { error: 'govde_gecersiz' });
    return;
  }

  const guild =
    client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) {
    json(res, 404, { error: 'sunucu_yok' });
    return;
  }

  const label = EVENT_LABELS[parsed.type] ?? EVENT_LABELS.diger;

  // Bot-native oyuncu durumu kaydi: giris/cikis olaylari /oyunda-mi icin.
  if (parsed.type === 'giris') recordPlayerJoin(guildId, parsed.player ?? {});
  else if (parsed.type === 'cikis') recordPlayerLeave(guildId, parsed.player ?? {});

  await emitLog(guild, 'log_cfx_wh', {
    title: `CFX: ${label}`,
    lines: labelsLines(parsed),
    accent: parsed.type === 'ban' ? 'error' : parsed.type === 'giris' ? 'success' : 'info',
    target: null,
    meta: { source: 'cfx-webhook', type: parsed.type },
  }).catch(() => {});

  json(res, 200, { ok: true });
}

/**
 * Webhook sunucusunu baslatir.
 * @returns {Promise<import('node:http').Server>}
 */
export function startCfxWebhookServer({ port, client }) {
  const logger = getLogger();
  server = http.createServer((req, res) => {
    handleRequest(req, res, client).catch((err) => {
      logger.warn({ err: err?.message }, 'CFX webhook istegi hatasi');
      try {
        json(res, 500, { error: 'ic_hata' });
      } catch {
        /* yut */
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      logger.info({ port }, 'CFX webhook ucu dinleniyor (/cfx/<guildId>)');
      resolve(server);
    });
  });
}

export function stopCfxWebhookServer() {
  return new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => {
      server = null;
      resolve();
    });
  });
}
