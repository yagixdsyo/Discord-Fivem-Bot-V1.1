/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import { escapeHtml, renderTranscriptHtml } from '../src/modules/logging/lib/transcript.js';

describe('escapeHtml', () => {
  it('tehlikeli karakterleri kacirir', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });
});

describe('renderTranscriptHtml', () => {
  it('mesajlari ve basligi icerir', () => {
    const html = renderTranscriptHtml({
      guildName: 'Test <Sunucu>',
      channelName: 'genel',
      messages: [
        { authorTag: 'ali', content: 'merhaba <dunya>', at: 1_700_000_000_000 },
        { authorTag: 'veli', content: 'ikinci mesaj', at: 1_700_000_060_000, hadAttachments: true },
      ],
    });

    expect(html).toContain('Test &lt;Sunucu&gt;');
    expect(html).toContain('merhaba &lt;dunya&gt;');
    expect(html).toContain('2 silinen mesaj');
    expect(html).toContain('[dosya eki]');
    expect(html).not.toContain('<script>');
  });

  it('bos icerik icin yer tutucu yazar', () => {
    const html = renderTranscriptHtml({
      guildName: 'X',
      channelName: 'y',
      messages: [{ authorTag: 'ali', content: '', at: Date.now() }],
    });
    expect(html).toContain('[içerik önbellekte yok]');
  });
});
