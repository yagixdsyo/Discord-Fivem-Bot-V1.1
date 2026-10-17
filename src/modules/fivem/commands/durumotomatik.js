/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';

function clampInt(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

async function configCard(t, guild, cfg) {
  const pingLabel = cfg.pingMembers ? t('fivem.check.auto_on') : t('fivem.check.auto_off');
  const lines = [
    t('fivem.check.auto_card_status', { durum: cfg.enabled ? t('fivem.kayit.open') : t('fivem.kayit.closed') }),
    t('fivem.check.auto_card_channel', { kanal: cfg.channelId ? `<#${cfg.channelId}>` : t('fivem.check.auto_none') }),
    t('fivem.check.auto_card_role', { rol: cfg.roleId ? `<@&${cfg.roleId}>` : t('fivem.check.auto_all') }),
    t('fivem.check.auto_card_interval', { dakika: cfg.intervalMinutes }),
    t('fivem.check.auto_card_ping', { durum: pingLabel }),
    t('fivem.check.auto_card_keywords', {
      liste: cfg.keywords.length ? cfg.keywords.join(', ') : t('fivem.check.auto_none'),
    }),
    cfg.lastRunAt
      ? t('fivem.check.auto_card_last', {
          zaman: `<t:${Math.floor(Date.parse(cfg.lastRunAt) / 1000)}:R>`,
          adet: cfg.lastMissing,
        })
      : t('fivem.check.auto_card_never'),
    t('fivem.check.auto_card_hint'),
  ];
  return card({
    emojiKey: 'ARAMA',
    title: t('fivem.check.auto_card_title'),
    subtitle: t('fivem.check.auto_sub', { sunucu: guild.name }),
    lines,
    accent: cfg.enabled ? 'primary' : 'info',
    footer: t('fivem.check.auto_card_footer'),
  });
}

export default {
  name: 'durum-otomatik',
  aliases: ['durumotomatik', 'durum-oto'],
  description: 'Durum otomatik kontrolünü ayarlar (argümansız: gösterir).',
  category: 'FiveM',
  system: null,
  cooldown: 10,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'durum', type: 'choice', required: false, choices: ['ac', 'kapat'], description: 'Sistemi açar/kapatır' },
    { name: 'kanal', type: 'channel', required: false, description: 'Kontrol sonuçlarının yazılacağı kanal' },
    { name: 'rol', type: 'role', required: false, description: 'Sadece bu roldeki üyeler kontrol edilir' },
    { name: 'dakika', type: 'integer', required: false, description: 'Kontrol aralığı (dakika, 5-1440)' },
    { name: 'etiket', type: 'boolean', required: false, description: 'Eksik/çevrimdışı üyeler etiketlensin mi' },
    { name: 'kelimeler', type: 'rest', required: false, description: 'Ek durum kelimeleri (virgülle) — "sifirla" temizler' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const lib = await import('../lib/presenceCheck.js');
    const guild = ctx.guild;
    const current = await lib.getPresenceConfig(guild.id);

    const durum = String(ctx.args.durum ?? '').trim().toLocaleLowerCase('tr');
    const kanal = ctx.args.kanal ?? null;
    const rol = ctx.args.rol ?? null;
    const dakika = ctx.args.dakika !== undefined ? clampInt(ctx.args.dakika, 5, 1440) : null;
    const etiket = typeof ctx.args.etiket === 'boolean' ? ctx.args.etiket : null;
    const kelimeler = String(ctx.args.kelimeler ?? '').trim();

    if (!durum && !kanal && !rol && dakika === null && etiket === null && !kelimeler) {
      await ctx.reply(await configCard(t, guild, current));
      return;
    }

    const patch = {};
    const changed = [];

    if (durum) {
      if (!['ac', 'kapat'].includes(durum)) {
        await ctx.reply(errorTemplate(t('fivem.check.auto_usage_title'), [t('fivem.check.auto_usage')]));
        return;
      }
      patch.enabled = durum === 'ac';
      changed.push(durum === 'ac' ? t('fivem.check.auto_changed_on') : t('fivem.check.auto_changed_off'));
    }

    if (kanal) {
      if (!(kanal.isTextBased?.() ?? kanal.type === 0)) {
        await ctx.reply(errorTemplate(t('fivem.check.auto_channel_title'), [t('fivem.check.auto_channel')]));
        return;
      }
      patch.channelId = kanal.id;
      patch.messageId = null;
      changed.push(t('fivem.check.auto_changed_channel', { kanal: `<#${kanal.id}>` }));
    }

    if (rol) {
      patch.roleId = rol.id;
      changed.push(t('fivem.check.auto_changed_role', { rol: `<@&${rol.id}>` }));
    }

    if (dakika !== null) {
      patch.intervalMinutes = dakika;
      changed.push(t('fivem.check.auto_changed_interval', { dakika }));
    }

    if (etiket !== null) {
      patch.pingMembers = etiket;
      changed.push(etiket ? t('fivem.check.auto_changed_ping_on') : t('fivem.check.auto_changed_ping_off'));
    }

    if (kelimeler) {
      if (/^s[iı]f[iı]rla$/i.test(kelimeler)) {
        patch.keywords = [];
        changed.push(t('fivem.check.auto_changed_keywords_clear'));
      } else {
        const list = [...new Set(kelimeler.split(/[,;\n]+/).map((word) => word.trim()).filter(Boolean))].slice(0, 10);
        patch.keywords = list;
        changed.push(t('fivem.check.auto_changed_keywords', { adet: list.length }));
      }
    }

    let config = await lib.setPresenceConfig(guild.id, patch);

    if (config.enabled && !config.channelId) {
      await ctx.reply(
        card({
          emojiKey: 'UYARI',
          title: t('fivem.check.auto_saved_title'),
          lines: [...changed, t('fivem.check.auto_channel_required')],
          accent: 'warn',
        }),
      );
      return;
    }

    const lines = [...changed];

    // Açıldıysa hemen bir tur çalıştır (etiketli ilk rapor).
    if (config.enabled && config.channelId && durum === 'ac') {
      const result = await lib
        .runPresenceCheck(guild, { t, config, force: true })
        .catch(() => null);
      if (result?.ok) {
        lines.push(
          t('fivem.check.auto_now_run', {
            kontrol: result.checked,
            eksik: result.missing.length,
            offline: result.offline.length,
          }),
        );
      } else {
        lines.push(t('fivem.check.auto_now_fail'));
      }
      config = await lib.getPresenceConfig(guild.id);
    }

    await ctx.reply(
      card({
        emojiKey: 'ARAMA',
        title: t('fivem.check.auto_saved_title'),
        lines,
        accent: 'success',
      }),
    );
    await ctx.followUp(await configCard(t, guild, config)).catch(() => {});
  },
};
