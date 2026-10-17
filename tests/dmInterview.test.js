/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTranslator } from '../src/locales/index.js';
import { clearFivemMemory } from '../src/modules/fivem/lib/store.js';
import { getInterview, inviteToInterview } from '../src/modules/fivem/lib/interviews.js';
import {
  DEFAULT_QUESTIONS,
  MAX_QUESTIONS,
  getDmQuestions,
  runDmQuestions,
  setDmQuestions,
} from '../src/modules/fivem/lib/dmInterview.js';

const t = createTranslator();
const G = 'g1';

function fakeUser(answerQueue) {
  const dm = {
    sent: [],
    async send(payload) {
      this.sent.push(payload);
      return null;
    },
    async awaitMessages() {
      if (!answerQueue.length) return null;
      const next = answerQueue.shift();
      if (next === null) return null;
      return { first: () => ({ author: { id: 'u1', bot: false }, content: next }) };
    },
  };
  return { id: 'u1', dmChannel: dm, _dm: dm };
}

beforeEach(() => clearFivemMemory());

describe('mulakat DM sorulari', () => {
  it('varsayilan sorular ve ozel soru kaydi', async () => {
    // DB yokken varsayilanlar doner
    expect(await getDmQuestions(G)).toEqual(DEFAULT_QUESTIONS);

    // Kaydetme girdileri temizler/kirpar (kalicilik DB ile; donus degerleri dogrulanir)
    const saved = await setDmQuestions(G, [' Soru A ', 'Soru B', '']);
    expect(saved).toEqual(['Soru A', 'Soru B']);

    const many = Array.from({ length: MAX_QUESTIONS + 5 }, (_, i) => `S${i}`);
    expect((await setDmQuestions(G, many)).length).toBe(MAX_QUESTIONS);

    expect(await setDmQuestions(G, [])).toEqual(DEFAULT_QUESTIONS);
  });

  it('sorulari sorar, yanitlari kayda isler', async () => {
    const doc = await inviteToInterview({ guildId: G, userId: 'u1', userTag: 'u1#0001', invitedBy: 'y1' });
    const user = fakeUser(['18 yasindayim', 'Deneyimim var', '3 saat oynarim']);

    const result = await runDmQuestions({
      t,
      user,
      guildId: G,
      interviewId: doc.interview_id,
      questions: ['Yas?', 'Deneyim?', 'Sure?'],
    });

    expect(result.ok).toBe(true);
    expect(result.answers.length).toBe(3);
    expect(user._dm.sent.length).toBe(3);

    const saved = await getInterview(G, doc.interview_id);
    expect(saved.dm_answers.length).toBe(3);
    expect(saved.dm_answers[0].cevap).toBe('18 yasindayim');
  });

  it('iptal ve zaman asimi akisi durdurur, kayit yazmaz', async () => {
    const doc = await inviteToInterview({ guildId: G, userId: 'u1', userTag: null, invitedBy: 'y1' });

    const cancelUser = fakeUser(['iptal']);
    const cancelResult = await runDmQuestions({
      t,
      user: cancelUser,
      guildId: G,
      interviewId: doc.interview_id,
      questions: ['A?', 'B?'],
    });
    expect(cancelResult.ok).toBe(false);
    expect(cancelResult.error).toBe('iptal');

    const timeoutUser = fakeUser([null]);
    const timeoutResult = await runDmQuestions({
      t,
      user: timeoutUser,
      guildId: G,
      interviewId: doc.interview_id,
      questions: ['A?'],
    });
    expect(timeoutResult.ok).toBe(false);
    expect(timeoutResult.error).toBe('zaman_asimi');

    const saved = await getInterview(G, doc.interview_id);
    expect(saved.dm_answers ?? null).toBe(null);
  });
});
