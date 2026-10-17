/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, warn as warnTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { getKayitState, registerMember } from '../lib/kayitFlow.js';
import { getSetting } from '../lib/state.js';
import { kayitResultPayload } from '../lib/view.js';

export default {
  name: 'kayıt',
  aliases: ['kayit'],
  description: 'Bir oyuncuyu kayıt eder (kayıtlı rolü + isim).',
  category: 'FiveM',
  system: 'kayit',
  cooldown: 3,
  permission: { discord: ['ManageNicknames'] },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Kayıt edilecek kullanıcı' },
    { name: 'icisim', type: 'string', required: true, description: 'IC isim' },
    { name: 'oocisim', type: 'string', required: false, description: 'OOC isim' },
    { name: 'zorla', type: 'boolean', required: false, description: 'Kayıt kapalıysa zorla' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const state = await getKayitState(ctx.guild.id);
    if (!state.open && ctx.args.zorla !== true) {
      await ctx.reply(warnTemplate(t('fivem.kayit.registration_closed_title'), [t('fivem.kayit.registration_closed')]));
      return;
    }

    const arg = ctx.args.kullanici;
    const member = arg?.roles ? arg : await ctx.guild.members.fetch(arg?.user?.id ?? arg?.id ?? '').catch(() => null);
    if (!member) {
      await ctx.reply(errorTemplate(t('fivem.kayit.member_missing_title'), [t('fivem.kayit.member_missing')]));
      return;
    }

    const icName = String(ctx.args.icisim ?? '').trim();
    const oocName = ctx.args.oocisim ? String(ctx.args.oocisim).trim() : null;
    if (!icName) {
      await ctx.reply(errorTemplate(t('fivem.kayit.name_required_title'), [t('fivem.kayit.name_required')]));
      return;
    }

    const minAccountDays = Number((await getSetting(ctx.guild.id, 'fivem.kayit.minAgeDays')) ?? 0) || 0;

    const result = await registerMember(ctx.guild, {
      member,
      actor: ctx.user,
      actorTag: ctx.user.username,
      icName,
      oocName,
      minAccountDays,
    });

    if (!result.ok) {
      const key = `fivem.kayit.error.${result.error}`;
      await ctx.reply(errorTemplate(t('fivem.kayit.error_title'), [t(key) === key ? t('fivem.kayit.error.generic') : t(key)]));
      return;
    }

    // yeniden kayit isim guncelleme sayilir.
    if (result.nameUpdated) {
      await emitLog(ctx.guild, 'log_isim_degisiklik', {
        actor: ctx.user.id,
        actorTag: ctx.user.username,
        target: member.id,
        targetTag: member.user.username,
        lines: [
          t('fivem.kayit.name_updated', {
            kullanici: `<@${member.id}>`,
            eski: `**${result.previous ?? '-'}**`,
            yeni: `**${result.icName}**`,
          }),
        ],
        accent: 'info',
      });
      await ctx.reply(
        success(t('fivem.kayit.name_updated_title'), [
          t('fivem.kayit.name_updated', {
            kullanici: `<@${member.id}>`,
            eski: `**${result.previous ?? '-'}**`,
            yeni: `**${result.icName}**`,
          }),
          t('fivem.kayit.name_updated_hint'),
        ]),
      );
      return;
    }

    await emitLog(ctx.guild, 'log_kayit', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: member.id,
      targetTag: member.user.username,
      lines: [t('fivem.kayit.log_line', { isim: `**${icName}**`, ooc: oocName ?? '-' })],
      accent: 'success',
      title: t('fivem.kayit.log_title'),
    });

    await emitLog(ctx.guild, 'log_isim_degisiklik', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: member.id,
      targetTag: member.user.username,
      lines: [t('fivem.kayit.nick_log', { isim: `**${icName}**` })],
      accent: 'info',
    });

    await ctx.reply(kayitResultPayload(t, { userId: member.id, icName, oocName, actorId: ctx.user.id }));
  },
};
