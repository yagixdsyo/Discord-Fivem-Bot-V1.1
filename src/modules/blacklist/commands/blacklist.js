/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { list as listTemplate, error as errorTemplate, success } from '../../../ui/templates/index.js';

export default {
  name: 'blacklist',
  aliases: [],
  description: 'Kara listeye ekle/cikar/liste/sorgu.',
  category: 'Blacklist',
  system: 'blacklist',
  cooldown: 3,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'islem', type: 'string', required: true, description: 'ekle|cikar|liste|sorgu' },
    { name: 'kullanici', type: 'user', required: false, description: 'Hedef kullanici' },
    { name: 'sebep', type: 'rest', required: false, description: 'Sebep/type' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/blacklist.js');
    const islem = String(ctx.args.islem || '').toLowerCase();
    if (islem === 'ekle') {
      const target = ctx.args.kullanici?.id ?? ctx.args.kullanici;
      if (!target) {
        await ctx.reply(errorTemplate(t('blacklist.target_need_title'), [t('blacklist.target_need')]));
        return;
      }
      const typ = String(ctx.args.sebep || 'player').split(' ')[0] || 'player';
      const reason = String(ctx.args.sebep || '').replace(/^\\S+/, '').trim() || null;
      await lib.addBlacklist({ guildId: ctx.guild.id, userId: target, type: typ, reason });
      await ctx.reply(success(t('blacklist.added_title'), [t('blacklist.added', { kullanici: `<@${target}>`, tur: typ })]));
      return;
    }
    if (islem === 'cikar') {
      const target = ctx.args.kullanici?.id ?? ctx.args.kullanici;
      if (!target) {
        await ctx.reply(errorTemplate(t('blacklist.target_need_title'), [t('blacklist.target_need')]));
        return;
      }
      await lib.removeBlacklist(ctx.guild.id, target);
      await ctx.reply(success(t('blacklist.removed_title'), [t('blacklist.removed', { kullanici: `<@${target}>` })]));
      return;
    }
    if (islem === 'sorgu') {
      const target = ctx.args.kullanici?.id ?? ctx.args.kullanici;
      if (!target) {
        await ctx.reply(errorTemplate(t('blacklist.target_need_title'), [t('blacklist.target_need')]));
        return;
      }
      const rec = await lib.blacklistLookup(ctx.guild.id, target);
      if (!rec) {
        await ctx.reply(success(t('blacklist.not_in_list_title'), [t('blacklist.not_in_list', { kullanici: `<@${target}>` })]));
        return;
      }
      await ctx.reply(success(t('blacklist.found_title'), [t('blacklist.found', { kullanici: `<@${target}>`, tur: rec.type, sebep: rec.reason || '-' })]));
      return;
    }
    if (islem === 'liste') {
      const rows = await lib.listBlacklist(ctx.guild.id, { limit: 20 });
      const lines = rows.map((r) => `<@${r.user_id}> | ${r.type} | ${r.reason || '-'}`);
      await ctx.reply(listTemplate({ title: t('blacklist.list_title'), lines: lines.length ? lines : [t('blacklist.list_empty')] }));
      return;
    }
    await ctx.reply(errorTemplate(t('blacklist.invalid_action_title'), [t('blacklist.invalid_action')]));
  },
};
