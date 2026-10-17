/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { emitLog } from '../../logging/lib/emit.js';

function clampInt(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function parseRoleIds(text) {
  const ids = [];
  for (const match of String(text ?? '').matchAll(/<@&(\d{5,25})>|(?<![\d])(\d{5,25})(?![\d])/g)) {
    const id = match[1] ?? match[2];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function settingsCard(t, guild, config, ladder) {
  const lines = [
    t('terfi.settings_line', {
      kanal: config.announceChannelId ? `<#${config.announceChannelId}>` : t('terfi.channel_none'),
    }),
    t('terfi.settings_points', {
      temel: config.basePoints,
      carpan: config.multiplier,
      ticket: config.pointsPerTicket,
    }),
  ];

  if (ladder.length) {
    lines.push(t('terfi.ladder_title'));
    for (const rank of ladder) {
      lines.push(
        t('terfi.ladder_line', {
          sira: rank.index + 1,
          rutbe: `**${rank.name}**`,
          rol: `<@&${rank.roleId}>`,
          esik: rank.threshold,
        }),
      );
    }
  } else {
    lines.push(t('terfi.settings_empty_ladder'));
  }
  lines.push(t('terfi.usage'));

  return card({
    emojiKey: 'TERFI',
    title: t('terfi.settings_title'),
    subtitle: t('terfi.settings_sub', { sunucu: guild.name }),
    lines,
    accent: 'primary',
    footer: t('terfi.settings_footer'),
  });
}

export default {
  name: 'yetkili-ayar',
  aliases: ['terfi-ayar'],
  description: 'Yetkili terfi sistemini ayarlar (argümansız: gösterir).',
  category: 'Yetkili',
  system: 'terfi',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'kanal', type: 'channel', required: false, description: 'Terfi duyuru kanalı' },
    { name: 'temel', type: 'integer', required: false, description: 'İlk rütbe eşiği (varsayılan 10)' },
    { name: 'carpan', type: 'integer', required: false, description: 'Eşik çarpanı (varsayılan 2)' },
    { name: 'ticketpuan', type: 'integer', required: false, description: 'Kapanan talep başına puan (varsayılan 1)' },
    {
      name: 'roller',
      type: 'rest',
      required: false,
      description: 'Terfi merdiveni rolleri sırayla (@rol1 @rol2 ...) — "sifirla" temizler',
    },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const lib = await import('../lib/staff.js');
    const guild = ctx.guild;

    const kanal = ctx.args.kanal ?? null;
    const temel = ctx.args.temel !== undefined ? clampInt(ctx.args.temel, 1, 100_000) : null;
    const carpan = ctx.args.carpan !== undefined ? clampInt(ctx.args.carpan, 2, 20) : null;
    const ticketPuan = ctx.args.ticketpuan !== undefined ? clampInt(ctx.args.ticketpuan, 0, 1_000) : null;
    const rollerText = String(ctx.args.roller ?? '').trim();

    // Argümansız: mevcut ayar kartı.
    if (!kanal && temel === null && carpan === null && ticketPuan === null && !rollerText) {
      const config = await lib.getStaffConfig(guild.id);
      await ctx.reply(await settingsCard(t, guild, config, lib.buildLadder(config)));
      return;
    }

    const patch = {};
    const changed = [];

    if (kanal) {
      const me = guild.members.me;
      const channelOk = kanal.isTextBased?.() ?? kanal.type === 0;
      if (!channelOk) {
        await ctx.reply(errorTemplate(t('terfi.channel_invalid_title'), [t('terfi.channel_invalid')]));
        return;
      }
      patch.announceChannelId = kanal.id;
      changed.push(t('terfi.changed_channel', { kanal: `<#${kanal.id}>` }));
    }

    if (temel !== null) {
      patch.basePoints = temel;
      changed.push(t('terfi.changed_temel', { deger: temel }));
    }

    if (carpan !== null) {
      patch.multiplier = carpan;
      changed.push(t('terfi.changed_carpan', { deger: carpan }));
    }

    if (ticketPuan !== null) {
      patch.pointsPerTicket = ticketPuan;
      changed.push(t('terfi.changed_ticket', { deger: ticketPuan }));
    }

    if (rollerText) {
      if (/^s[iı]f[iı]rla$/i.test(rollerText)) {
        patch.rankRoleIds = [];
        changed.push(t('terfi.changed_roles_clear'));
      } else {
        const ids = parseRoleIds(rollerText);
        if (!ids.length) {
          await ctx.reply(errorTemplate(t('terfi.role_usage_title'), [t('terfi.role_usage')]));
          return;
        }
        const me = guild.members.me;
        const tooHigh = ids
          .map((id) => guild.roles.cache.get(id))
          .filter((role) => role && (!me || me.roles.highest.position <= role.position));
        if (tooHigh.length) {
          await ctx.reply(
            errorTemplate(t('terfi.role_too_high_title'), [
              t('terfi.role_too_high', { roller: tooHigh.map((role) => `<@&${role.id}>`).join(', ') }),
            ]),
          );
          return;
        }
        patch.rankRoleIds = ids.slice(0, 12);
        changed.push(t('terfi.changed_roles', { adet: patch.rankRoleIds.length }));
      }
    }

    if (!changed.length) {
      const config = await lib.getStaffConfig(guild.id);
      await ctx.reply(await settingsCard(t, guild, config, lib.buildLadder(config)));
      return;
    }

    const config = await lib.setStaffConfig(guild.id, patch);
    const ladder = lib.buildLadder(config);

    await emitLog(guild, 'log_yetki_ver_al', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [t('terfi.log_line', { degisim: changed.join(' · ') })],
      accent: 'info',
    }).catch(() => {});

    await ctx.reply(
      card({
        emojiKey: 'TERFI',
        title: t('terfi.saved_title'),
        lines: changed,
        accent: 'success',
      }),
    );
    await ctx.followUp(await settingsCard(t, guild, config, ladder)).catch(() => {});
  },
};
