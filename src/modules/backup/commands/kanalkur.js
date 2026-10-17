/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { parseBackupData } from '../lib/create.js';
import { getLatestBackup } from '../lib/store.js';
import { restoreSingleChannel } from '../lib/install.js';
import { channelRestorePayload, lastBackupMissingPayload } from '../lib/view.js';

export default {
  name: 'kanal-kur',
  aliases: ['kanalkur'],
  description: 'Silinen bir kanalı backup’tan geri kurar (izin ağıyla).',
  category: 'Backup',
  cooldown: 10,
  permission: { discord: ['Administrator'] },
  args: [{ name: 'kanal', type: 'string', required: true, description: 'Kanal adı veya ID' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const doc = (await getLatestBackup(ctx.guild.id, 'manual')) ?? (await getLatestBackup(ctx.guild.id, 'auto'));
    if (!doc) {
      await ctx.reply(lastBackupMissingPayload(t, { kinds: ['manual', 'auto'] }));
      return;
    }

    const data = await parseBackupData(doc);
    if (!data) {
      await ctx.reply(errorTemplate(t('backup.missing.corrupt_title'), [t('backup.missing.corrupt_body')]));
      return;
    }

    const ref = String(ctx.args.kanal ?? '').trim();
    const result = await restoreSingleChannel(ctx.guild, data, ref);
    const channelName = result.channel?.name ?? ref;
    const errorText = result.error === 'kanal_backup_ta_yok' ? t('backup.channel.not_found') : result.error;

    await ctx.reply(
      channelRestorePayload(t, {
        channelName,
        mode: result.ok ? result.mode : 'missing',
        error: errorText,
      }),
    );
  },
};
