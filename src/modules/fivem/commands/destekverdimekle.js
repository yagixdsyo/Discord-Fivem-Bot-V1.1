/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { runListPager } from '../../moderation/lib/uiFlow.js';
import { addSupportRecord, listSupportRecords, supportStats } from '../lib/support.js';
import { supportRecordListPayload, supportStatsPayload } from '../lib/view.js';

const PAGE_SIZE = 8;

export default {
  name: 'destek-verdim',
  aliases: ['destekverdimekle'],
  description: 'Destek kaydı ekler; kayıtları ve istatistikleri listeler.',
  category: 'FiveM',
  system: 'destek_bekleme',
  cooldown: 5,
  permission: { discord: [] },
  args: [
    {
      name: 'islem',
      type: 'choice',
      required: true,
      description: 'İşlem',
      choices: [
        { name: 'Ekle', value: 'ekle' },
        { name: 'Liste', value: 'liste' },
        { name: 'Detay (istatistik)', value: 'detay' },
      ],
    },
    { name: 'kullanici', type: 'user', required: false, description: 'Destek verilen kullanıcı (ekle) / yetkili (liste)' },
    {
      name: 'tur',
      type: 'choice',
      required: false,
      description: 'Destek türü',
      choices: [
        { name: 'Genel', value: 'genel' },
        { name: 'Destek', value: 'destek' },
        { name: 'Kayıt', value: 'kayit' },
        { name: 'Whitelist', value: 'whitelist' },
        { name: 'Şikayet', value: 'sikayet' },
        { name: 'Mülakat', value: 'mulakat' },
      ],
    },
    { name: 'dakika', type: 'integer', required: false, description: 'Süre (dakika)' },
    { name: 'gun', type: 'integer', required: false, description: 'İstatistik gün aralığı (detay)' },
    { name: 'not', type: 'rest', required: false, description: 'Not' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const islem = ctx.args.islem;
    const ownerId = ctx.user.id;

    if (islem === 'ekle') {
      const arg = ctx.args.kullanici;
      const user = arg?.user ?? arg;
      if (!user) {
        await ctx.reply(errorTemplate(t('fivem.destek.rec_user_required_title'), [t('fivem.destek.rec_user_required')]));
        return;
      }

      const doc = await addSupportRecord({
        guildId: ctx.guild.id,
        actorId: ctx.user.id,
        actorTag: ctx.user.username,
        userId: user.id,
        userTag: user.username ?? null,
        kind: ctx.args.tur ?? 'genel',
        minutes: ctx.args.dakika ?? 0,
        note: ctx.args.not ? String(ctx.args.not).trim() : null,
      });

      await emitLog(ctx.guild, 'log_destek', {
        actor: ctx.user.id,
        actorTag: ctx.user.username,
        target: user.id,
        targetTag: user.username,
        lines: [
          t('fivem.destek.rec_log', {
            kullanici: `<@${user.id}>`,
            tur: t(`fivem.destek.kind.${doc.kind}`),
            dakika: `**${doc.minutes}**`,
          }),
          doc.note ? t('fivem.destek.rec_log_note', { not: doc.note }) : null,
        ].filter(Boolean),
        accent: 'success',
      });

      await ctx.reply(
        success(t('fivem.destek.rec_added_title'), [
          t('fivem.destek.rec_added', { kullanici: `<@${user.id}>`, dakika: `**${doc.minutes}**`, kod: `\`${doc.record_id}\`` }),
        ]),
      );
      return;
    }

    if (islem === 'liste') {
      const arg = ctx.args.kullanici;
      const target = arg?.user ?? arg;
      const isSelf = !target || target.id === ctx.user.id;
      if (!isSelf && !ctx.memberPermissions?.has('ManageRoles')) {
        await ctx.reply(errorTemplate(t('errors.no_permission.title'), [t('errors.no_permission.body')]));
        return;
      }

      const items = await listSupportRecords(ctx.guild.id, {
        actorId: target ? target.id : ctx.user.id,
        limit: 200,
      });
      const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
      const islemOwner = ctx.user.id;

      await runListPager(ctx, {
        namespace: 'destekkayit',
        totalPages,
        buildPage: (page) => supportRecordListPayload(t, { items, page, ownerId: islemOwner, pageSize: PAGE_SIZE }),
      });
      return;
    }

    // detay: yetkili bazli istatistik
    const days = Math.max(1, Math.min(365, ctx.args.gun ?? 30));
    const rows = await supportStats(ctx.guild.id, { days });
    const payload = supportStatsPayload(t, { rows, days });
    await ctx.reply(payload);
  },
};
