/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { AttachmentBuilder } from 'discord.js';

export default {
  name: 'veri-yedegi',
  aliases: ['export-data'],
  description: 'Ticket, Shift ve Team kayıtlarını JSON dosyası olarak dışa aktarır.',
  category: 'Analitik',
  system: 'analitik',
  cooldown: 30,
  permission: { discord: ['ManageGuild'] },
  args: [],
  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }
    const { listTickets } = await import('../../ticket/lib/tickets.js');
    const { findDocs } = await import('../../fivem/lib/store.js');
    const { listTeams } = await import('../../team/lib/teams.js');
    const tickets = await listTickets(ctx.guild.id, { limit: 500 }).catch(() => []);
    const shifts = await findDocs('shifts', { guild_id: ctx.guild.id }, { limit: 1000 }).catch(() => []);
    const teams = await listTeams(ctx.guild.id).catch(() => []);
    const payload = JSON.stringify({ guildId: ctx.guild.id, generatedAt: new Date().toISOString(), tickets, shifts, teams }, null, 2);
    const attachment = new AttachmentBuilder(Buffer.from(payload), { name: `analitik-${Date.now()}.json` });
    await ctx.reply({ ...success(t('export.sent_title'), [t('export.sent_line')]), files: [attachment] });
  },
};
