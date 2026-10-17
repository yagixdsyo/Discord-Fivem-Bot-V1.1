/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export class AiClientError extends Error {}

export function defaultAiConfig(env = process.env) {
  return {
    apiKey: env.NVIDIA_API_KEY ?? '',
    baseUrl: env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1',
    model: env.NVIDIA_MODEL ?? 'meta/llama-4-maverick-17b-128e-instruct',
    timeoutMs: Number(env.NVIDIA_TIMEOUT_MS ?? 20000),
    rateLimitSeconds: Number(env.NVIDIA_RATE_LIMIT_SECONDS ?? 30),
    maxTokens: Number(env.NVIDIA_MAX_TOKENS ?? 900),
  };
}

export class AiClient {
  constructor(rawConfig) {
    const cfg = rawConfig ?? defaultAiConfig();
    this.apiKey = String(cfg.apiKey ?? '').trim();
    this.baseUrl = String(cfg.baseUrl ?? '').replace(/\/+$/, '');
    this.model = String(cfg.model ?? '').trim();
    this.timeoutMs = Number(cfg.timeoutMs ?? 20000);
    this.rateLimitSeconds = Number(cfg.rateLimitSeconds ?? 30);
    this.maxTokens = Number(cfg.maxTokens ?? 900);
  }

  isConfigured() { return Boolean(this.apiKey && this.baseUrl && this.model); }

  async chat(messages, { temperature = 0.4, topP = 0.9 } = {}) {
    if (!this.isConfigured()) throw new AiClientError('NVIDIA_API_KEY tanimli degil');
    const url = `${this.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature,
          top_p: topP,
          max_tokens: this.maxTokens,
          stream: false,
        }),
      });
      const text = await response.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch {}
      if (!response.ok) {
        throw new AiClientError(`NVIDIA API istegi basarisiz (${response.status}): ${JSON.stringify(json ?? text).slice(0,500)}`);
      }
      const answer = json?.choices?.[0]?.message?.content
        || json?.choices?.[0]?.delta?.content
        || '';
      if (!answer.trim()) throw new AiClientError('NVIDIA API bos yanit dondurdu');
      return answer;
    } catch (error) {
      if (error instanceof AiClientError) throw error;
      throw new AiClientError(`NVIDIA API erisilemiyor: ${error?.message ?? error}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createAiClient(env = process.env) {
  return new AiClient(defaultAiConfig(env));
}

export const FIVEM_SYSTEM_PROMPT = [
  'Sen FiveM (CfxRE) gelistirme konusunda Turkce yardim veren uzman bir asistansin.',
  'ESX/QBCore/fivem frameworklerini, Lua (client/server/shared), fxmanifest, resmon, FiveM security ve performans konularini bilirsin.',
  'Guvenli kod: eval kullanma, input dogrulama, yetki kontrolu, SQL injection koruması, XSS temizligi, race condition kontrolu.',
  'Cevaplarini markdown + kod bloklari ile net, kisa ve uygulanabilir ver.',
  'Emin degilsen belirsizlik belirt ve test etmeyi oner.',
].join(' ');
