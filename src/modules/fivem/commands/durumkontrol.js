/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ActivityType } from 'discord.js';
import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';

export default {
  name: 'durum-kontrol',
  aliases: ['durumkontrol'],
  description: 'Üyelerin durum mesajında sunucu davet linkini kontrol eder; isterse DM ile hatırlatır.',
  category: 'FiveM',
  system: null,
  cooldown: 30,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'rol', type: 'role', required: false, description: 'Sadece bu roldeki üyeler' },
    { name: 'hatırlat', type: 'boolean', required: false, description: 'Eksik olanlara DM ile hatırlat' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const role = ctx.args.rol ?? null;

    let members;
    if (role) {
      members = [...(role.members?.values() ?? [])];
    } else {
      members = [...ctx.guild.members.cache.values()];
      if (members.length === 0) {
        const fetched = await ctx.guild.members.fetch().catch(() => null);
        members = fetched ? [...fetched.values()] : [];
      }
    }
    members = members.filter((member) => !member.user.bot);

    if (members.length === 0) {
      await ctx.reply(errorTemplate(t('fivem.check.empty_title'), [t('fivem.check.empty')]));
      return;
    }

    const vanity = ctx.guild.vanityURLCode ? `discord.gg/${ctx.guild.vanityURLCode}`.toLowerCase() : null;
    const guildName = ctx.guild.name.toLowerCase();

    let seen = 0;
    const missing = [];
    for (const member of members) {
      const custom = member.presence?.activities?.find((activity) => activity.type === ActivityType.Custom);
      const state = String(custom?.state ?? '').toLowerCase();
      if (!member.presence) continue; // cevrimdisi: durum gorunmez
      seen += 1;
      const ok = (vanity && state.includes(vanity)) || state.includes(guildName);
      if (!ok) missing.push(member);
    }

    let dmOk = 0;
    if (ctx.args.hatırlat === true && missing.length > 0) {
      const reminder = card({
        emojiKey: 'DUYURU',
        title: t('fivem.check.dm_title', { sunucu: ctx.guild.name }),
        lines: [t('fivem.check.dm_line'), vanity ? t('fivem.check.dm_vanity', { link: `**${vanity}**` }) : null].filter(Boolean),
        accent: 'warn',
      });
      for (const member of missing.slice(0, 200)) {
        const ok = await member.send(reminder).then(() => true).catch(() => false);
        if (ok) dmOk += 1;
      }
    }

    const preview = missing.slice(0, 30).map((member) => `<@${member.id}>`).join(', ');
    await ctx.reply(
      card({
        emojiKey: 'ARAMA',
        title: t('fivem.check.title'),
        lines: [
          t('fivem.check.scanned', { taranan: `**${seen}**`, eksik: `**${missing.length}**` }),
          vanity ? t('fivem.check.vanity', { link: `**${vanity}**` }) : t('fivem.check.no_vanity'),
          missing.length ? t('fivem.check.list', { liste: preview }) : t('fivem.check.all_ok'),
          ctx.args.hatırlat === true && missing.length ? t('fivem.check.dm_result', { adet: `**${dmOk}**` }) : null,
          seen === 0 ? t('fivem.check.presence_note') : null,
        ].filter(Boolean),
        accent: missing.length ? 'warn' : 'success',
      }),
    );
  },
};
