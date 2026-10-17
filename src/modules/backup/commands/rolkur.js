/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { parseBackupData } from '../lib/create.js';
import { getLatestBackup } from '../lib/store.js';
import { restoreSingleRole } from '../lib/install.js';
import { lastBackupMissingPayload, roleRestorePayload } from '../lib/view.js';

export default {
  name: 'rol-kur',
  aliases: ['rolkur'],
  description: 'Silinen bir rolü backup’tan geri kurar (izin/renk/sıra + üyeler).',
  category: 'Backup',
  cooldown: 10,
  permission: { discord: ['Administrator'] },
  args: [{ name: 'rol', type: 'string', required: true, description: 'Rol adı veya ID' }],

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

    const ref = String(ctx.args.rol ?? '').trim();
    const result = await restoreSingleRole(ctx.guild, data, ref);
    const roleName = result.role?.name ?? ref;
    const errorText = result.error === 'rol_backup_ta_yok' ? t('backup.role.not_found') : result.error;

    await ctx.reply(
      roleRestorePayload(t, {
        roleName,
        mode: result.ok ? result.mode : 'missing',
        error: errorText,
      }),
    );
  },
};
