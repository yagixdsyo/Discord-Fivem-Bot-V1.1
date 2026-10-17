/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { isOwnerUser, isPrimaryOwner } from '../src/core/ownerRegistry.js';

const PRIMARY = '100000000000000001';
const SECOND = '100000000000000002';

describe('isPrimaryOwner', () => {
  const config = { ownerIds: [PRIMARY, SECOND] };

  it('yalnizca ilk sahip ana sahiptir', () => {
    expect(isPrimaryOwner(config, PRIMARY)).toBe(true);
    expect(isPrimaryOwner(config, SECOND)).toBe(false);
  });

  it('bos/eksik yapilandirmada false', () => {
    expect(isPrimaryOwner({ ownerIds: [] }, PRIMARY)).toBe(false);
    expect(isPrimaryOwner(null, PRIMARY)).toBe(false);
    expect(isPrimaryOwner(config, null)).toBe(false);
  });
});

describe('isOwnerUser (Redis yok)', () => {
  const config = { ownerIds: [PRIMARY] };

  beforeEach(() => {
    // Redis baglantisi baslatilmaz; isRedisReady() false kalir.
  });

  it('env sahibi her zaman sahiptir', async () => {
    expect(await isOwnerUser(config, PRIMARY)).toBe(true);
  });

  it('env disindaki kullanici Redis yoksa sahip degildir', async () => {
    expect(await isOwnerUser(config, '999999999999999999')).toBe(false);
  });

  it('bos kullanici id sahip degildir', async () => {
    expect(await isOwnerUser(config, '')).toBe(false);
    expect(await isOwnerUser(config, null)).toBe(false);
  });

  it('config null olsa bile cokmez', async () => {
    expect(await isOwnerUser(null, PRIMARY)).toBe(false);
  });
});
