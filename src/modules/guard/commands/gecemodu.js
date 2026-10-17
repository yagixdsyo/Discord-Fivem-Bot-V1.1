/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, info as infoTemplate, success as successTemplate } from '../../../ui/templates/index.js';
import { applyWake, getNightDoc, parseTime, runNightTick, setNightDoc } from '../lib/night.js';
import { nightModePayload } from '../lib/view.js';

export default {
  name: 'gece-modu',
  aliases: ['gecemodu'],
  description: 'Gece modu: belirlenen saatlerde tehlikeli izinleri geçici alır.',
  category: 'Guard',
  system: 'guard',
  cooldown: 5,
  permission: { discord: ['Administrator'] },
  args: [
    {
      name: 'islem',
      type: 'choice',
      required: true,
      description: 'İşlem',
      choices: ['ac', 'kapat', 'durum', 'ayar'].map((value) => ({ name: value, value })),
    },
    { name: 'baslangic', type: 'string', required: false, description: 'Başlangıç saati (HH:MM)' },
    { name: 'bitis', type: 'string', required: false, description: 'Bitiş saati (HH:MM)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const islem = String(ctx.args.islem ?? 'durum').toLowerCase();
    const baslangic = ctx.args.baslangic ? String(ctx.args.baslangic).trim() : null;
    const bitis = ctx.args.bitis ? String(ctx.args.bitis).trim() : null;

    if (baslangic && parseTime(baslangic) === null) {
      await ctx.reply(errorTemplate(t('guard.night.invalid_time_title'), [t('guard.night.invalid_time_body', { saat: baslangic })]));
      return;
    }
    if (bitis && parseTime(bitis) === null) {
      await ctx.reply(errorTemplate(t('guard.night.invalid_time_title'), [t('guard.night.invalid_time_body', { saat: bitis })]));
      return;
    }

    let doc = await getNightDoc(ctx.guild.id, { fresh: true });

    if (islem === 'durum') {
      await ctx.reply(nightModePayload(t, { doc }));
      return;
    }

    if (islem === 'ac') {
      const patch = { enabled: true };
      if (baslangic) patch.start = baslangic;
      if (bitis) patch.end = bitis;
      const result = await setNightDoc(ctx.guild.id, patch);
      if (!result.ok) {
        await ctx.reply(errorTemplate(t('guard.ayar.failed_title'), [t('guard.ayar.failed_body')]));
        return;
      }
      doc = await getNightDoc(ctx.guild.id, { fresh: true });
      await ctx.reply(successTemplate(t('guard.night.enabled_title'), [
        `${t('guard.night.window')}: **${doc.start} - ${doc.end}** (${doc.timezone})`,
        t('guard.night.enabled_body'),
      ]));
      // Aninda uygula (pencere icindeyse)
      const tick = await runNightTick(ctx.client, ctx.guild.id, ctx.config).catch(() => null);
      if (tick?.action === 'sleep') {
        await ctx.followUp(infoTemplate(t('guard.night.sleep_now_title'), [
          t('guard.night.sleep_now_body', { adet: tick.stripped ?? 0 }),
        ])).catch(() => {});
      }
      return;
    }

    if (islem === 'kapat') {
      await setNightDoc(ctx.guild.id, { enabled: false });
      doc = await getNightDoc(ctx.guild.id, { fresh: true });
      if (doc.sleeping) {
        const wake = await applyWake(ctx.client, ctx.guild, doc, ctx.config).catch(() => null);
        await ctx.reply(successTemplate(t('guard.night.disabled_title'), [
          wake ? t('guard.night.disabled_woke', { adet: wake.restored ?? 0 }) : t('guard.night.disabled_body'),
        ]));
        return;
      }
      await ctx.reply(successTemplate(t('guard.night.disabled_title'), [t('guard.night.disabled_body')]));
      return;
    }

    if (islem === 'ayar') {
      if (!baslangic && !bitis) {
        await ctx.reply(errorTemplate(t('guard.night.no_time_title'), [t('guard.night.no_time_body')]));
        return;
      }
      const patch = {};
      if (baslangic) patch.start = baslangic;
      if (bitis) patch.end = bitis;
      await setNightDoc(ctx.guild.id, patch);
      doc = await getNightDoc(ctx.guild.id, { fresh: true });
      await ctx.reply(nightModePayload(t, { doc }));
    }
  },
};
