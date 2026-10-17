/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import { matchEmojis } from '../src/ui/emojiMatch.js';

describe('matchEmojis', () => {
  it('isimleri buyuk/kucuk harf duyarsiz esler', () => {
    const { matched, unmatched } = matchEmojis({
      keys: ['BASARI', 'hata', 'YOK'],
      available: [
        { id: '111', name: 'basari', animated: false },
        { id: '222', name: 'HATA', animated: true },
      ],
    });
    expect(matched).toEqual([
      { key: 'BASARI', id: '111', animated: false },
      { key: 'hata', id: '222', animated: true },
    ]);
    expect(unmatched).toEqual(['YOK']);
  });

  it('gecersiz girdileri atlar ve ayni isimde ilkini kullanir', () => {
    const { matched } = matchEmojis({
      keys: ['ONAY'],
      available: [
        { id: null, name: 'onay' },
        { id: '1', name: 'onay' },
        { id: '2', name: 'onay' },
      ],
    });
    expect(matched).toEqual([{ key: 'ONAY', id: '1', animated: false }]);
  });

  it('bos girdilerde guvenli', () => {
    expect(matchEmojis({}).matched).toEqual([]);
    expect(matchEmojis({}).unmatched).toEqual([]);
  });
});
