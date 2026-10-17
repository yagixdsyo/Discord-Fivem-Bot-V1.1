/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { deleteByPattern } from '../../core/redis.js';
import { auditAction } from '../lib/audit.js';
import { success } from '../../ui/templates/index.js';

const PATTERNS = ['gate:*', 'mod:*', 'perm:*', 'cfg:guild:*', 'deploy:hash:*'];

export default {
  name: 'önbellek-temizle',
  aliases: ['onbellek-temizle'],
  description: 'Komut/ayar önbelleklerini temizler.',
  category: 'Sistem',

  async run(ctx) {
    const t = ctx.t;

    let deleted = 0;
    for (const pattern of PATTERNS) {
      deleted += await deleteByPattern(pattern);
    }

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'onbellek-temizle',
      payload: { silinen: deleted, desenler: PATTERNS },
      t,
    });

    await ctx.reply(success(t('owner.cache.done'), [t('owner.cache.result', { adet: deleted })]));
  },
};
