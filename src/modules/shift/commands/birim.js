/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, list as listTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';

export default {
  name: 'birim',
  aliases: ['birim-yonet'],
  description: 'Mesai birim(devriye) sistemi.',
  category: 'Mesai',
  system: 'mesai',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [{ name: 'islem', type: 'string', required: true, description: 'kur|sil|liste|ekle|cikar|not' }],
  async run(ctx) {
    const t = ctx.t;
    const islem = String(ctx.args.islem || '').toLowerCase();
    const lib = await import('../lib/shifts.js');
    const unitId = ctx.args.birim ?? '';

    if (islem === 'liste') {
      const units = await lib.listUnits(ctx.guild.id, { active: true });
      const lines = units.length
        ? units.map((u) => t('mesai.unit_list_line', { id: u.unit_id, ad: u.name, uye: u.members?.length ?? 0, not: u.note ?? '-' }))
        : [t('mesai.unit_empty')];
      await ctx.reply(listTemplate({ emojiKey: 'BIRIM', title: t('mesai.unit_list_title'), lines }));
      return;
    }

    if (islem === 'kur') {
      const ad = String(ctx.args.ad ?? ctx.args.birim ?? 'Devriye').slice(0, 40);
      const unit = await lib.createUnit({ guildId: ctx.guild.id, name: ad, leadId: ctx.user.id });
      await ctx.reply(
        card({
          emojiKey: 'BIRIM',
          title: t('mesai.unit_created_title'),
          lines: [t('mesai.unit_created', { id: unit.unit_id, ad: unit.name })],
          accent: 'success',
          footer: `\`${unit.unit_id}\``,
        }),
      );
      return;
    }

    if (islem === 'sil' && unitId) {
      await lib.deactivateUnit(ctx.guild.id, unitId);
      await ctx.reply(
        card({
          emojiKey: 'BIRIM',
          title: t('mesai.unit_deactivated_title'),
          lines: [t('mesai.unit_deactivated', { id: unitId })],
          accent: 'warn',
          footer: `\`${unitId}\``,
        }),
      );
      return;
    }

    if (islem === 'ekle' && unitId) {
      const target = (ctx.args.ekstra?.match?.(/<@!?(\d+)>/) || [])[1] || ctx.args.kullanici?.id;
      if (!target) {
        await ctx.reply(errorTemplate(t('mesai.target_missing_title'), [t('mesai.target_missing')]));
        return;
      }
      await lib.addUnitMember(ctx.guild.id, unitId, target);
      await ctx.reply(
        card({
          emojiKey: 'EKLE',
          title: t('mesai.unit_member_added_title'),
          lines: [t('mesai.unit_member_added', { id: unitId, kullanici: `<@${target}>` })],
          accent: 'success',
          footer: `\`${unitId}\``,
        }),
      );
      return;
    }

    if (islem === 'cikar' && unitId) {
      const target = (ctx.args.ekstra?.match?.(/<@!?(\d+)>/) || [])[1];
      if (!target) {
        await ctx.reply(errorTemplate(t('mesai.target_missing_title'), [t('mesai.target_missing')]));
        return;
      }
      await lib.removeUnitMember(ctx.guild.id, unitId, target);
      await ctx.reply(
        card({
          emojiKey: 'CIKAR',
          title: t('mesai.unit_member_removed_title'),
          lines: [t('mesai.unit_member_removed', { id: unitId, kullanici: `<@${target}>` })],
          accent: 'warn',
          footer: `\`${unitId}\``,
        }),
      );
      return;
    }

    if (islem === 'not' && unitId) {
      const note = String(ctx.args.ekstra ?? ctx.args.not ?? '').trim();
      await lib.updateUnitNote(ctx.guild.id, unitId, note === '' ? null : note);
      await ctx.reply(
        card({
          emojiKey: 'NOT',
          title: t('mesai.unit_note_title'),
          lines: [t('mesai.unit_note', { id: unitId }), note ? `> ${note}` : null],
          accent: 'info',
          footer: `\`${unitId}\``,
        }),
      );
      return;
    }

    await ctx.reply(errorTemplate(t('mesai.unit_usage_title'), [t('mesai.unit_usage')]));
  },
};
