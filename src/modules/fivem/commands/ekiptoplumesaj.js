/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { getTeam, listTeams } from '../lib/teams.js';

export default {
  name: 'ekip-toplu-mesaj',
  aliases: ['ekiptoplumesaj'],
  description: 'Tüm ekiplerin ticket kanallarına (veya tek ekibe) duyuru gönderir.',
  category: 'FiveM',
  system: null,
  cooldown: 15,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'mesaj', type: 'rest', required: true, description: 'Gönderilecek mesaj' },
    { name: 'ekip', type: 'string', required: false, description: 'Tek ekip (boşsa tümü)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const text = String(ctx.args.mesaj ?? '').trim();
    if (!text) {
      await ctx.reply(errorTemplate(t('fivem.ekip.message_required_title'), [t('fivem.ekip.message_required')]));
      return;
    }

    const key = ctx.args.ekip ? String(ctx.args.ekip).trim() : null;
    let targets;
    if (key) {
      const team = (await getTeam(ctx.guild.id, { teamId: key })) ?? (await getTeam(ctx.guild.id, { name: key }));
      targets = team ? [team] : [];
      if (!team) {
        await ctx.reply(errorTemplate(t('fivem.ekip.not_found_title'), [t('fivem.ekip.not_found', { ekip: key })]));
        return;
      }
    } else {
      targets = await listTeams(ctx.guild.id, { active: true, limit: 200 });
    }

    const payload = card({
      emojiKey: 'EKIP',
      title: t('fivem.ekip.bulk_title'),
      lines: [text, t('fivem.ekip.bulk_by', { kisi: ctx.member?.displayName ?? ctx.user.username })],
      accent: 'info',
    });

    let sent = 0;
    const failed = [];
    for (const team of targets) {
      const channelId = team.ticket_id ?? team.text_id;
      if (!channelId) {
        failed.push(team.name);
        continue;
      }
      const channel = ctx.guild.channels.cache.get(channelId) ?? (await ctx.guild.channels.fetch(channelId).catch(() => null));
      if (!channel || typeof channel.send !== 'function') {
        failed.push(team.name);
        continue;
      }
      const ok = await channel
        .send(payload)
        .then(() => true)
        .catch(() => false);
      if (ok) sent += 1;
      else failed.push(team.name);
    }

    await ctx.reply(
      success(t('fivem.ekip.bulk_done_title'), [
        t('fivem.ekip.bulk_done', { adet: `**${sent}**`, hatali: `**${failed.length}**` }),
        failed.length ? t('fivem.ekip.bulk_failed_list', { liste: failed.slice(0, 15).join(', ') }) : null,
      ].filter(Boolean)),
    );
  },
};
