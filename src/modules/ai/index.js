/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { createTranslator } from '../../locales/index.js';
import { createAiClient, FIVEM_SYSTEM_PROMPT } from './lib/client.js';
import { card } from '../../ui/templates/base.js';
import { error as errorTemplate, info } from '../../ui/templates/index.js';

const conversations = new Map();
const rateLimits = new Map();
const usage = new Map();

function cfg() { return createAiClient(process.env); }
function defaultSystem(mode = 'genel', useFivemContext = false) {
  const modePrompts = {
    genel: 'Sen Turkce konusan, Discord ve FiveM konusunda faydali bir asistansin.',
    fivem: FIVEM_SYSTEM_PROMPT,
    kod: FIVEM_SYSTEM_PROMPT + ' Kod cevaplarinda dogru moduller, hata ayiklama ve uygulanabilir ornekler ver.',
    sql: 'SQL (MariaDB/MySQL) sorgularini guvenli, index-optimize ve FiveM DB uyumlu sekilde anlat; SQL injection risklerini belirt.',
    guvenlik: 'FiveM guvenlik incelemesi yap; auth, input validation, race condition, logging ve least privilege noktalarini belirt.',
    aciklama: 'Kodu Turkce olarak baslangic, calisma ve optimizasyon adimlari ile acikla.',
  };
  if (!useFivemContext && mode !== 'fivem') return modePrompts[mode] ?? modePrompts.genel;
  if (useFivemContext) return FIVEM_SYSTEM_PROMPT + (modePrompts[mode] ? ' ' + modePrompts[mode].split('. ').slice(1).join('. ') : '');
  return modePrompts[mode] ?? modePrompts.genel;
}

function trimHistory(userId, maxTurns = 8) {
  const now = Date.now();
  const item = conversations.get(userId);
  if (!item || now - item.updatedAt > 25 * 60 * 1000) {
    conversations.delete(userId);
    return [];
  }
  item.history = item.history.slice(-maxTurns);
  item.updatedAt = now;
  return item.history;
}

function setHistory(userId, history) {
  conversations.set(userId, { history: history.slice(-12), updatedAt: Date.now() });
}

function isRateLimited(userId, seconds) {
  const now = Date.now();
  const last = rateLimits.get(userId) ?? 0;
  if (now - last < seconds * 1000) return true;
  rateLimits.set(userId, now);
  return false;
}

function titleFor(answer) { return answer.length > 140 ? `${answer.slice(0, 140).trim()}...` : answer.trim(); }

const ready = { done: false };
function registerHandlers() { if (ready.done) return; ready.done = true; }

export function clearConversation(userId) {
  conversations.delete(userId);
  rateLimits.delete(userId);
  usage.delete(userId);
}

export function getConversationStats(userId) {
  const item = conversations.get(userId);
  if (!item) return { turns: 0, words: 0, lastActivity: null };
  return {
    turns: item.history.length,
    words: item.history.reduce((sum, x) => sum + String(x.content ?? '').split(/\s+/).length, 0),
    lastActivity: new Date(item.updatedAt).toISOString(),
  };
}

export async function askAi({ userId, prompt, mode = 'fivem', useFivemContext = true, temperature = 0.4, topP = 0.9 }) {
  const client = cfg();
  if (!client.isConfigured()) return { ok: false, reason: 'not_configured' };
  if (isRateLimited(userId, client.rateLimitSeconds)) return { ok: false, reason: 'rate_limited' };
  const safePrompt = String(prompt || '').trim().slice(0, 4000);
  if (!safePrompt) return { ok: false, reason: 'empty' };

  const history = trimHistory(userId);
  const messages = [
    { role: 'system', content: defaultSystem(mode, useFivemContext) },
    ...history,
    { role: 'user', content: safePrompt },
  ];
  const answer = await client.chat(messages, { temperature, topP });
  const nextHistory = [...history, { role: 'user', content: safePrompt }, { role: 'assistant', content: answer }];
  setHistory(userId, nextHistory);
  const previous = usage.get(userId) ?? { calls: 0, tokens: 0 };
  usage.set(userId, { calls: previous.calls + 1, tokens: previous.tokens + safePrompt.length + answer.length });
  return { ok: true, answer, title: titleFor(answer), mode, stats: getConversationStats(userId) };
}

export default {
  id: 'ai',
  name: 'YZ Assistant',
  description: 'NVIDIA/OpenAI-uyumlu AI API ile FiveM yardimi ve sohbet.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,

  async setup(client, { logger }) {
    registerHandlers();
    logger.info('AI modulu hazir');
    client.on('messageCreate', (message) => {
      this.handleMention(message).catch(() => {});
    });
    const enabled = cfg().isConfigured();
    if (enabled) logger.info({ model: cfg().model }, 'AI entegrasyonu aktif');
    else logger.warn('NVIDIA_API_KEY tanimli degil; AI komutlari ve mention sohbeti devre disik kaldi.');
    client.on('clientReady', () => {
      client.user?.presence?.set?.({ status: 'online', activities: [{ name: 'Fivemci AI / AI' }] }).catch(() => {});
    });
  },

  async handleMention(message) {
    if (!message?.guild || message.author?.bot || !message.client?.user || !message.mentions?.has?.(message.client.user)) return false;
    const t = createTranslator();
    const prompt = String(message.content ?? '').replace(message.client.user.toString(), '').trim();
    if (!prompt) {
      await message.reply(info(t('ai.mention_help_title'), [t('ai.mention_help')])).catch(() => {});
      return true;
    }
    if (isRateLimited(message.author.id, cfg().rateLimitSeconds)) {
      await message.reply(errorTemplate(t('ai.rate_limit_title'), [t('ai.rate_limit')])).catch(() => {});
      return true;
    }
    await message.channel.sendTyping().catch(() => {});
    try {
      const result = await askAi({ userId: message.author.id, prompt, mode: 'fivem', useFivemContext: true, temperature: 0.4 });
      if (!result.ok) {
        if (result.reason === 'not_configured') await message.reply(errorTemplate(t('ai.not_configured_title'), [t('ai.not_configured')])).catch(() => {});
        else if (result.reason === 'rate_limited') await message.reply(errorTemplate(t('ai.rate_limit_title'), [t('ai.rate_limit')])).catch(() => {});
        else await message.reply(errorTemplate(t('ai.empty_title'), [t('ai.empty')])).catch(() => {});
        return true;
      }
      const replyCard = card({
        emojiKey: 'BILGI',
        title: t('ai.answer_title'),
        lines: [result.answer.slice(0, 1800)],
        accent: 'primary',
        footer: `-# ${t('ai.footer_line', { mode: result.mode, turns: result.stats.turns })}`,
      });
      await message.reply({ ...replyCard, allowedMentions: { repliedUser: false } }).catch(() => {});
      return true;
    } catch {
      await message.reply(errorTemplate(t('ai.error_title'), [t('ai.error_generic')])).catch(() => {});
      return true;
    }
  },
};
