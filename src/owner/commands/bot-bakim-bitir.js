/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { setGlobalMaintenance } from '../lib/state.js';
import { auditAction } from '../lib/audit.js';
import { setMaintenanceAnnouncementLinked } from '../../core/announcements.js';
import { success, warn } from '../../ui/templates/index.js';

export default {
  name: 'bot-bakım-bitir',
  aliases: ['bot-bakim-bitir'],
  description: 'Global bakım modunu bitirir.',
  category: 'Bot',

  async run(ctx) {
    const t = ctx.t;
    const result = await setGlobalMaintenance({ enabled: false, setBy: ctx.user.id });
    if (!result.ok) {
      await ctx.reply(warn(t('owner.db_unavailable'), []));
      return;
    }

    const closed = await setMaintenanceAnnouncementLinked(false).catch(() => null);

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'bot-bakim-bitir',
      payload: { duyuru: closed?.title ?? null },
      t,
    });

    const lines = closed ? [t('owner.maintenance.announcement_closed', { baslik: closed.title })] : [];
    await ctx.reply(success(t('owner.maintenance.ended'), lines));
  },
};
