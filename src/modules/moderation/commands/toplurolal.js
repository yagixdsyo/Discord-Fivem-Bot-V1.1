/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { collectUserIds, runBulkRole } from '../lib/bulkFlow.js';

export default {
  name: 'toplu-rolal',
  aliases: ['toplurolal'],
  description: 'Birden çok üyeden tek rol alır.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 10,
  permission: { discord: ['ManageRoles'], node: 'moderation.rol' },
  args: [
    { name: 'rol', type: 'role', required: true, description: 'Alınacak rol' },
    { name: 'dosya', type: 'attachment', required: false, description: 'Kullanıcı id listesi dosyası (.txt/.csv)' },
    { name: 'kullanicilar', type: 'rest', required: false, description: 'Etiket veya id listesi' },
  ],

  async run(ctx) {
    const ids = await collectUserIds(ctx, {
      rest: ctx.args.kullanicilar ?? null,
      attachment: ctx.args.dosya ?? null,
    });
    await runBulkRole(ctx, { role: ctx.args.rol, userIds: ids, action: 'cikar' });
  },
};
