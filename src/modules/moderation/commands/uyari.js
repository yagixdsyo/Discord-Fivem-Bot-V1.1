/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { emitLog } from '../../logging/lib/emit.js';
import {
  addWarning,
  countActiveWarnings,
  getWarning,
  listWarnings,
  reduceOldestWarnings,
  removeWarning,
  resetWarnings,
} from '../lib/store.js';
import { runListPager } from '../lib/uiFlow.js';
import { warningListPayload } from '../lib/view.js';

const PAGE_SIZE = 8;
const MAX_ITEMS = 400;

async function verRun(ctx) {
  const t = ctx.t;
  const targetMember = ctx.args.kullanici;
  const targetUser = targetMember.user;
  const tur = ctx.args.tur ?? 'genel';
  const sebep = String(ctx.args.sebep ?? '').trim() || null;

  const doc = await addWarning({
    guildId: ctx.guild.id,
    userId: targetUser.id,
    type: tur,
    reason: sebep,
    actorId: ctx.user.id,
    actorTag: ctx.user.username ?? null,
  });

  const activeCount = await countActiveWarnings(ctx.guild.id, targetUser.id).catch(() => 1);

  await emitLog(ctx.guild, 'log_uyari', {
    actor: ctx.user.id,
    actorTag: ctx.user.username ?? null,
    target: targetUser.id,
    targetTag: targetUser.username ?? null,
    reason: sebep,
    lines: [
      `Tür: **${t(`moderation.warn.type.${tur}`)}**`,
      `Aktif uyarı: **${activeCount}**`,
      `Kayıt: \`${doc.warning_id}\``,
      sebep ? `Sebep: ${sebep}` : null,
    ].filter(Boolean),
    accent: 'warn',
  });

  await ctx.reply(
    card({
      emojiKey: 'UYARI_VER',
      title: t('moderation.warn.given_title'),
      lines: [
        t('moderation.result.target', { kullanici: `<@${targetUser.id}>`, etiket: targetUser.username }),
        t('moderation.warn.count_line', { adet: activeCount }),
        t('moderation.warn.case_line', { kod: `\`${doc.warning_id}\`` }),
        sebep ? t('moderation.result.reason', { sebep }) : null,
        activeCount >= 3 ? t('moderation.warn.caution') : null,
      ].filter(Boolean),
      accent: 'warn',
    }),
  );

  try {
    await targetUser.send(
      card({
        emojiKey: 'UYARI_VER',
        title: t('moderation.warn.dm_title', { sunucu: ctx.guild.name }),
        lines: [
          sebep ? t('moderation.dm.reason', { sebep }) : null,
          t('moderation.warn.dm_count', { adet: activeCount }),
          t('moderation.dm.contact'),
        ].filter(Boolean),
        accent: 'warn',
      }),
    );
  } catch {
    /* DM kapali */
  }
}

async function listeRun(ctx) {
  const t = ctx.t;
  const userId = ctx.args.kullanici?.id ?? ctx.user.id;
  const items = await listWarnings(ctx.guild.id, { userId, active: true, limit: MAX_ITEMS });
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const ownerId = ctx.user.id;

  await runListPager(ctx, {
    namespace: 'uyariliste',
    totalPages,
    buildPage: (page) => warningListPayload(t, { userId, items, page, ownerId, pageSize: PAGE_SIZE }),
  });
}

async function silRun(ctx) {
  const t = ctx.t;
  const target = ctx.args.kullanici;
  const targetUser = target?.user ?? target;
  const kod = String(ctx.args.kod ?? '').trim();

  const doc = await getWarning(ctx.guild.id, kod);
  if (!doc || doc.user_id !== targetUser.id) {
    await ctx.reply(errorTemplate(t('moderation.warn.not_found_title'), [t('moderation.warn.not_found_body')]));
    return;
  }

  const result = await removeWarning(ctx.guild.id, kod, { actorId: ctx.user.id, reason: 'Manuel silme' });
  if (!result.ok) {
    await ctx.reply(errorTemplate(t('moderation.warn.not_found_title'), [t('moderation.warn.not_found_body')]));
    return;
  }

  const activeCount = await countActiveWarnings(ctx.guild.id, targetUser.id).catch(() => 0);
  await ctx.reply(
    card({
      emojiKey: 'SIL',
      title: t('moderation.warn.removed_title'),
      lines: [
        t('moderation.result.target', { kullanici: `<@${targetUser.id}>`, etiket: targetUser.username }),
        t('moderation.warn.count_line', { adet: activeCount }),
      ],
      accent: 'success',
    }),
  );
}

async function azaltRun(ctx) {
  const t = ctx.t;
  const target = ctx.args.kullanici;
  const targetUser = target?.user ?? target;
  const adet = Math.min(Math.max(1, ctx.args.adet ?? 1), 20);

  const removed = await reduceOldestWarnings(ctx.guild.id, targetUser.id, adet, { actorId: ctx.user.id });
  const activeCount = await countActiveWarnings(ctx.guild.id, targetUser.id).catch(() => 0);

  await ctx.reply(
    card({
      emojiKey: 'CIKAR',
      title: t('moderation.warn.reduced_title'),
      lines: [
        t('moderation.result.target', { kullanici: `<@${targetUser.id}>`, etiket: targetUser.username }),
        t('moderation.warn.reduced_line', { adet: removed.length }),
        t('moderation.warn.count_line', { adet: activeCount }),
      ],
      accent: 'success',
    }),
  );
}

async function sifirlaRun(ctx) {
  const t = ctx.t;
  const target = ctx.args.kullanici;
  const targetUser = target?.user ?? target;

  const removed = await resetWarnings(ctx.guild.id, targetUser.id, { actorId: ctx.user.id });
  await ctx.reply(
    card({
      emojiKey: 'RED',
      title: t('moderation.warn.reset_title'),
      lines: [
        t('moderation.result.target', { kullanici: `<@${targetUser.id}>`, etiket: targetUser.username }),
        t('moderation.warn.reset_line', { adet: removed }),
      ],
      accent: 'success',
    }),
  );
}

async function sayRun(ctx) {
  const t = ctx.t;
  const target = ctx.args.kullanici;
  const targetUser = target?.user ?? target;

  const active = await countActiveWarnings(ctx.guild.id, targetUser.id).catch(() => 0);
  const all = await listWarnings(ctx.guild.id, { userId: targetUser.id, active: null, limit: 500 });
  await ctx.reply(
    card({
      emojiKey: 'UYARI_VER',
      title: t('moderation.warn.say_title'),
      lines: [
        t('moderation.result.target', { kullanici: `<@${targetUser.id}>`, etiket: targetUser.username }),
        t('moderation.warn.count_line', { adet: active }),
        t('moderation.warn.total_line', { adet: all.length }),
      ],
      accent: 'info',
    }),
  );
}

export default {
  name: 'uyarı',
  aliases: ['uyari', 'warn'],
  description: 'Uyarı sistemi: ver, listele, sil, azalt, sıfırla, say.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  permission: { discord: ['ModerateMembers'], node: 'moderation.uyari' },
  subcommands: [
    {
      name: 'ver',
      description: 'Kullanıcıya uyarı verir.',
      args: [
        { name: 'kullanici', type: 'member', required: true, description: 'Uyarılacak üye' },
        {
          name: 'tur',
          type: 'choice',
          required: false,
          description: 'Uyarı türü',
          choices: [
            { name: 'Genel', value: 'genel' },
            { name: 'Etkinlik', value: 'etkinlik' },
            { name: 'Araç', value: 'arac' },
          ],
        },
        { name: 'sebep', type: 'rest', required: false, description: 'Uyarı sebebi' },
      ],
      run: verRun,
    },
    {
      name: 'liste',
      description: 'Aktif uyarıları listeler.',
      args: [{ name: 'kullanici', type: 'user', required: false, description: 'Kullanıcı (boşsa kendin)' }],
      run: listeRun,
    },
    {
      name: 'sil',
      description: 'Tek uyarı kaydını siler.',
      args: [
        { name: 'kullanici', type: 'user', required: true, description: 'Kullanıcı' },
        { name: 'kod', type: 'string', required: true, description: 'Uyarı kayıt kodu (c-...)' },
      ],
      run: silRun,
    },
    {
      name: 'azalt',
      description: 'En eski uyarılardan azaltır.',
      args: [
        { name: 'kullanici', type: 'user', required: true, description: 'Kullanıcı' },
        { name: 'adet', type: 'integer', required: false, description: 'Adet (varsayılan 1)' },
      ],
      run: azaltRun,
    },
    {
      name: 'sifirla',
      description: 'Tüm aktif uyarıları sıfırlar.',
      args: [{ name: 'kullanici', type: 'user', required: true, description: 'Kullanıcı' }],
      run: sifirlaRun,
    },
    {
      name: 'say',
      description: 'Uyarı sayılarını gösterir.',
      args: [{ name: 'kullanici', type: 'user', required: true, description: 'Kullanıcı' }],
      run: sayRun,
    },
  ],
};
