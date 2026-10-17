/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import http from 'node:http';
import { VERSION } from '../core/version.js';
import { getLogger } from '../core/logger.js';

/**
 * Saglik endpointi (/health) - 
 * Docker/PM2 saglik kontrolu ve uptime izleme bu ucu kullanir.
 */

let server = null;
const startedAt = Date.now();

const DEFAULT_CHECKS = [];

/**
 * @param {{ port: number, checks?: Array<{name: string, check: => Promise<boolean> | boolean}> }} opts
 */
export function startHealthServer({ port, checks = DEFAULT_CHECKS }) {
  const logger = getLogger();

  server = http.createServer(async (req, res) => {
    if (req.method !== 'GET' || !req.url) {
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'not_found' }));
      return;
    }

    const pathname = req.url.split('?')[0];

    if (pathname === '/health') {
      const results = {};
      let healthy = true;

      for (const { name, check } of checks) {
        try {
          const ok = await check();
          results[name] = ok ? 'ok' : 'hata';
          if (!ok) healthy = false;
        } catch (err) {
          results[name] = 'hata';
          healthy = false;
          logger.debug({ err: err?.message, check: name }, 'Health check basarisiz');
        }
      }

      const body = {
        status: healthy ? 'ok' : 'degraded',
        version: VERSION,
        uptime_s: Math.floor((Date.now() - startedAt) / 1000),
        checks: results,
        time: new Date().toISOString(),
      };

      res.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      logger.info({ port }, 'Saglik endpointi dinleniyor (/health)');
      resolve(server);
    });
  });
}

export function stopHealthServer() {
  return new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => {
      server = null;
      resolve();
    });
  });
}
