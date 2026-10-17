/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { afterEach, describe, expect, it } from 'vitest';
import { clearMemoryQueues, getQueueLength } from '../src/modules/logging/lib/queue.js';
import {
  findStoredLog,
  handleProtectedDelete,
  setLogDeletePunisher,
  storeSentLog,
} from '../src/modules/logging/lib/protection.js';

const GUILD_ID = '777777777777777777';
const CHANNEL_ID = '888888888888888888';
const MESSAGE_ID = '999999999999999999';

afterEach(() => {
  clearMemoryQueues();
  setLogDeletePunisher(null);
});

describe('storeSentLog / findStoredLog', () => {
  it('gonderilen kopya bellekte bulunur', async () => {
    await storeSentLog({
      guildId: GUILD_ID,
      channelId: CHANNEL_ID,
      messageId: MESSAGE_ID,
      items: [{ key: 'log_ban', entry: { actor: '111111111111111111' }, at: Date.now() }],
    });
    const doc = await findStoredLog(MESSAGE_ID);
    expect(doc).not.toBeNull();
    expect(doc.keys).toEqual(['log_ban']);
  });

  it('bilinmeyen mesaj icin null doner', async () => {
    expect(await findStoredLog('yok')).toBeNull();
  });
});

describe('handleProtectedDelete', () => {
  it('kopyasi olmayan mesajda devreye girmez', async () => {
    const handled = await handleProtectedDelete(
      {
        id: 'bilinmeyen',
        channelId: CHANNEL_ID,
        guildId: GUILD_ID,
        guild: null,
      },
      { client: { user: { id: 'bot' } } },
    );
    expect(handled).toBe(false);
  });

  it('silinen log mesajini yeniden kuyruga koyar + uyari karti ekler', async () => {
    await storeSentLog({
      guildId: GUILD_ID,
      channelId: CHANNEL_ID,
      messageId: MESSAGE_ID,
      items: [
        { key: 'log_ban', entry: { actor: '111111111111111111' }, at: Date.now() },
        { key: 'log_kick', entry: { actor: '111111111111111111' }, at: Date.now() },
      ],
    });

    const fakeGuild = {
      id: GUILD_ID,
      fetchAuditLogs: async () => {
        throw new Error('audit yok (test)');
      },
    };

    const handled = await handleProtectedDelete(
      { id: MESSAGE_ID, channelId: CHANNEL_ID, guildId: GUILD_ID, guild: fakeGuild },
      { client: { user: { id: 'bot' } } },
    );

    expect(handled).toBe(true);
    // 2 orijinal kayit + 1 uyari karti
    expect(await getQueueLength(CHANNEL_ID)).toBe(3);
  });

  it('ceza uygulayici yalnizca ayar acikken cagirilir (DB yokken kapali)', async () => {
    await storeSentLog({
      guildId: GUILD_ID,
      channelId: CHANNEL_ID,
      messageId: '101010101010101010',
      items: [{ key: 'log_ban', entry: {}, at: Date.now() }],
    });

    let punished = 0;
    setLogDeletePunisher(async () => {
      punished += 1;
    });

    await handleProtectedDelete(
      { id: '101010101010101010', channelId: CHANNEL_ID, guildId: GUILD_ID, guild: null },
      { client: { user: { id: 'bot' } } },
    );
    expect(punished).toBe(0);
  });
});
