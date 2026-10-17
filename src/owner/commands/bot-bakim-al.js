/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { parseMaintenanceInput } from '../lib/parse.js';
import { setGlobalMaintenance } from '../lib/state.js';
import { auditAction } from '../lib/audit.js';
import { setMaintenanceAnnouncementLinked } from '../../core/announcements.js';
import { success, warn } from '../../ui/templates/index.js';

export default {
  name: 'bot-bakım-al',
  aliases: ['bot-bakim-al'],
  description: 'Botu global bakım moduna alır.',
  category: 'Bot',
  args: [
    { name: 'girdi', type: 'rest', required: false, description: '[süre] [sebep]' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const { duration, reason } = parseMaintenanceInput(ctx.args.girdi);
    const until = duration ? Date.now() + duration.ms : null;

    const result = await setGlobalMaintenance({ enabled: true, reason, until, setBy: ctx.user.id });
    if (!result.ok) {
      await ctx.reply(warn(t('owner.db_unavailable'), []));
      return;
    }

    // Bakim duyurusu varsa otomatik acilir
    const linked = await setMaintenanceAnnouncementLinked(true).catch(() => null);

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'bot-bakim-al',
      payload: { sure: duration?.display ?? null, sebep: reason, duyuru: linked?.title ?? null },
      t,
    });

    const lines = [
      until
        ? t('owner.maintenance.until', { bitis: `<t:${Math.floor(until / 1000)}:R>` })
        : t('owner.maintenance.indefinite'),
      linked ? t('owner.maintenance.announcement_linked', { baslik: linked.title }) : t('owner.maintenance.announcement_none'),
    ];
    if (reason) lines.push(t('owner.reason_line', { sebep: reason }));

    await ctx.reply(success(t('owner.maintenance.done'), lines));
  },
};
