/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { disabledCard } from '../../../ui/templates/base.js';
import { confirm as confirmTemplate, error as errorTemplate, warn as warnTemplate } from '../../../ui/templates/index.js';
import { ensureMessage, waitForInteraction } from '../../setup/lib/interact.js';
import { createBackup } from '../lib/create.js';
import { listBackups } from '../lib/store.js';
import { deleteFlow, installFlow } from '../lib/flow.js';
import { backupListPayload, backupSummaryPayload } from '../lib/view.js';

export default {
  name: 'backup',
  aliases: [],
  description: 'Sunucu backup’ı alır, gösterir, kurar veya siler.',
  category: 'Backup',
  cooldown: 10,
  permission: { discord: ['Administrator'] },
  args: [
    {
      name: 'islem',
      type: 'choice',
      required: true,
      description: 'İşlem',
      choices: ['al', 'goster', 'kur', 'sil'].map((value) => ({ name: value, value })),
    },
    { name: 'temizle', type: 'boolean', required: false, description: 'Kurulumda backup sonrası fazlalıkları da temizle' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const islem = String(ctx.args.islem ?? 'goster').toLowerCase();
    const temizle = ctx.args.temizle === true;

    if (islem === 'al') {
      const result = await createBackup(ctx.guild, { kind: 'manual', by: ctx.user.id });
      await ctx.reply(backupSummaryPayload(t, { result }));
      return;
    }

    if (islem === 'goster') {
      const docs = await listBackups(ctx.guild.id);
      await ctx.reply(backupListPayload(t, { docs }));
      return;
    }

    if (islem === 'kur') {
      if (temizle) {
        // Yikici temizleme icin ayrica onay istenir (12.4)
        const ownerId = ctx.user.id;
        const warnCard = confirmTemplate({
          title: t('backup.delete_extra.title'),
          description: [t('backup.delete_extra.body')],
          confirmId: `backuptmz:onay:${ownerId}`,
          cancelId: `backuptmz:iptal:${ownerId}`,
          danger: true,
          confirmLabel: t('backup.delete_extra.confirm'),
        });
        const message = await ensureMessage(ctx, await ctx.reply(warnCard, { fetchReply: true }));
        if (!message || typeof message.awaitMessageComponent !== 'function') return;
        const decision = await waitForInteraction(message, ownerId);
        if (!decision || decision.customId !== `backuptmz:onay:${ownerId}`) {
          if (decision) await decision.update(warnTemplate(t('setup.cancel.title'), [t('setup.cancel.body')])).catch(() => {});
          else await message.edit(disabledCard(warnCard)).catch(() => {});
          return;
        }
        await decision.update(disabledCard(warnCard)).catch(() => {});
      }
      await installFlow(ctx, { kinds: ['manual', 'auto'], temizle, idPrefix: 'backupkur' });
      return;
    }

    if (islem === 'sil') {
      await deleteFlow(ctx);
    }
  },
};
