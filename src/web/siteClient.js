/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { z } from 'zod';

const cfgSchema = z.object({
  baseUrl: z.string().url().optional(),
  token: z.string().optional(),
  timeoutMs: z.number().int().min(1000).max(30000).default(10000),
});

export class SiteIntegrationDisabled extends Error {}
export class SiteClientError extends Error {
  constructor(message, { code = null, status = null, details = null } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function defaultSiteConfig(env = process.env) {
  return {
    baseUrl: env.SITE_API_BASE_URL ?? '',
    token: env.SITE_API_TOKEN ?? '',
    timeoutMs: Number(env.SITE_API_TIMEOUT_MS ?? 10000),
  };
}

export class SiteClient {
  constructor(rawConfig) {
    const cfg = cfgSchema.parse(rawConfig ?? defaultSiteConfig());
    this.baseUrl = cfg.baseUrl || '';
    this.token = cfg.token || '';
    this.timeoutMs = cfg.timeoutMs;
  }

  isConfigured() {
    return Boolean(this.baseUrl);
  }

  _url(path) {
    if (!path.startsWith('/')) path = `/${path}`;
    return `${this.baseUrl.replace(/\/+$/, '')}${path}`;
  }

  async _request(method, path, body = null, { headers = {} } = {}) {
    if (!this.isConfigured()) throw new SiteIntegrationDisabled('site entegrasyonu yapilandirilmamis');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const init = { method, signal: controller.signal, headers: { Accept: 'application/json', ...headers } };
      if (this.token) init.headers.Authorization = `Bearer ${this.token}`;
      if (body !== null) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
      const response = await fetch(this._url(path), init);
      const text = await response.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch {}
      if (!response.ok) {
        throw new SiteClientError(`Site API istegi basarisiz: ${method} ${path}`, {
          status: response.status,
          code: json?.code ?? null,
          details: json ?? text,
        });
      }
      return json;
    } catch (error) {
      if (error instanceof SiteClientError || error instanceof SiteIntegrationDisabled) throw error;
      throw new SiteClientError(`Site API erisilemiyor (${method} ${path}): ${error?.message ?? error}`, {
        code: 'network_error',
        details: error,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async health() { return this._request('GET', '/health'); }
  async createAccount(payload) { return this._request('POST', '/accounts/create', payload); }
  async syncMesai(payload) { return this._request('POST', '/mesai/sync', payload); }
  async accountLookup({ discordId }) { return this._request('GET', `/accounts/by-discord?discord_id=${encodeURIComponent(discordId)}`); }
  async queryPresence({ discordId }) { return this._request('GET', `/presence/query?discord_id=${encodeURIComponent(discordId)}`); }
  async pushApplication(payload) { return this._request('POST', '/applications/sync', payload); }
  async rankMapping(guildId) { return this._request('GET', `/ranks?guild_id=${encodeURIComponent(guildId)}`); }
  async uploadTranscript(payload) { return this._request('POST', '/upload/transcript', payload); }
  async uploadVideo(payload) { return this._request('POST', '/upload/video', payload); }
}

export default SiteClient;
export async function createSiteClient(env = process.env) {
  const client = new SiteClient(defaultSiteConfig(env));
  return client;
}
