/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { confirm as confirmTemplate, error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { runConfirm } from '../../moderation/lib/uiFlow.js';
import { getRoleId } from '../lib/maps.js';
import { pullUsers, voiceHumans } from '../lib/voice.js';

const STAFF_KEYS = ['yonetici', 'ust_yetkili', 'moderator', 'yetkili', 'destek', 'ban_yetkilisi', 'mulakatci', 'kayit_yetkilisi'];

export default {
  name: 'toplantı-ses-çek',
  aliases: ['toplanti-ses-cek'],
  description: 'Yetkili rollerindeki üyeleri toplantı ses kanalına çeker.',
  category: 'FiveM',
  system: null,
  cooldown: 30,
  permission: { discord: ['MoveMembers'] },
  args: [
    { name: 'kanal', type: 'voiceChannel', required: false, description: 'Hedef kanal (boşsa bulunduğum kanal)' },
    { name: 'herkes', type: 'boolean', required: false, description: 'Yetkililer yerine tüm üyeleri çek' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const target = ctx.args.kanal ?? ctx.member?.voice?.channel ?? null;
    if (!target) {
      await ctx.reply(errorTemplate(t('fivem.voice.not_in_voice_title'), [t('fivem.voice.not_in_voice')]));
      return;
    }

    const everyone = ctx.args.herkes === true;
    const staffIds = new Set();
    if (!everyone) {
      for (const key of STAFF_KEYS) {
        const id = await getRoleId(ctx.guild.id, key);
        if (id) staffIds.add(id);
      }
      if (staffIds.size === 0) {
        await ctx.reply(errorTemplate(t('fivem.voice.no_staff_roles_title'), [t('fivem.voice.no_staff_roles')]));
        return;
      }
    }

    // Ses kanallarindaki hedef kitle
    const candidates = [];
    for (const channel of ctx.guild.channels.cache.values()) {
      if (channel.type !== 2) continue; // GuildVoice
      for (const member of voiceHumans(channel)) {
        if (member.voice?.channelId === target.id) continue;
        if (everyone || [...staffIds].some((id) => member.roles.cache.has(id))) candidates.push(member.id);
      }
    }

    if (candidates.length === 0) {
      await ctx.reply(errorTemplate(t('fivem.voice.no_candidates_title'), [t('fivem.voice.no_candidates')]));
      return;
    }

    const ownerId = ctx.user.id;
    const payload = confirmTemplate({
      title: t('fivem.voice.meeting_confirm_title'),
      description: [
        t('fivem.voice.meeting_confirm_body', {
          adet: `**${candidates.length}**`,
          kanal: `<#${target.id}>`,
          kapsam: everyone ? t('fivem.voice.scope_everyone') : t('fivem.voice.scope_staff'),
        }),
      ],
      confirmId: `toplanticeronay:${ownerId}`,
      cancelId: `toplanticeriptal:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });
    const confirmed = await runConfirm(ctx, {
      payload,
      ownerId,
      confirmId: `toplanticeronay:${ownerId}`,
      cancelId: `toplanticeriptal:${ownerId}`,
    });
    if (!confirmed) return;

    const result = await pullUsers(ctx.guild, candidates, target.id, { reason: `Toplanti ses cekme: ${ctx.user.id}` });
    await ctx.followUp(
      card({
        emojiKey: 'TOPLANTI',
        title: t('fivem.voice.meeting_done_title'),
        lines: [
          t('fivem.voice.meeting_done', { adet: `**${result.moved.length}**`, hatali: `**${result.failed.length}**`, kanal: `<#${target.id}>` }),
        ],
        accent: 'success',
      }),
    );
  },
};
