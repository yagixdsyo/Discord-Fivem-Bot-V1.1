/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { blacklistCheck } from '../lib/info.js';
import { inviteCount, inviterOfUser } from '../lib/invites.js';
import { countActiveWarnings, findActiveByUser } from '../lib/store.js';
import { userInfoPayload } from '../lib/view.js';
import { emitLog } from '../../logging/lib/emit.js';
import { gallery } from '../../../ui/v2.js';
import { renderProfilePng } from '../../../ui/canvas/cards.js';
import { getColor } from '../../../ui/colors.js';

export default {
  name: 'kullanıcı-bilgi',
  aliases: ['kullanicibilgi', 'kullanici-bilgi'],
  description: 'Bir kullanıcının bilgi kartını gösterir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  args: [{ name: 'kullanici', type: 'user', required: false, description: 'Kullanıcı (boşsa kendin)' }],

  async run(ctx) {
    const t = ctx.t;
    const arg = ctx.args.kullanici ?? ctx.member;
    const targetUser = arg?.user ?? arg ?? ctx.user;
    const member = ctx.guild.members.cache.get(targetUser.id) ?? null;

    await emitLog(ctx.guild, 'log_sorgu', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: targetUser.id,
      targetTag: targetUser.username,
      lines: [t('moderation.query.sorgu_line', { tur: t('moderation.query.sorgu_user') })],
      accent: 'info',
    });

    const createdSec = Math.floor((targetUser.createdTimestamp ?? Date.now()) / 1000);
    const joinedSec = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

    const active = await findActiveByUser(ctx.guild.id, targetUser.id).catch(() => []);
    const warnCount = await countActiveWarnings(ctx.guild.id, targetUser.id).catch(() => 0);
    const davetSayisi = await inviteCount(ctx.guild.id, targetUser.id).catch(() => 0);
    const davetEden = await inviterOfUser(ctx.guild.id, targetUser.id).catch(() => null);
    const blacklist = await blacklistCheck(ctx.guild.id, targetUser.id).catch(() => null);

    const voiceChannel = member?.voice?.channel ?? ctx.guild.voiceStates?.cache?.get?.(targetUser.id)?.channel ?? null;
    const voiceText = voiceChannel ? `<#${voiceChannel.id}>` : null;

    const payloadObj = userInfoPayload(t, {
      userTag: targetUser.username,
      userId: targetUser.id,
      createdSec,
      joinedSec,
      roles: member ? [...member.roles.cache.keys()].filter((id) => id !== ctx.guild.id) : [],
      activeCount: active.length,
      warnCount,
      inviteCount: davetSayisi,
      inviterId: davetEden?.inviter_id ?? null,
      voiceText,
      blacklistText: blacklist ? t('moderation.user_info.blacklist_yes') : null,
    });

    // Canvas profil karti (galeri olarak eklenir; hata halinde metin karti kalir)
    const fileName = `kullanici-${targetUser.id}.png`;
    const png = await renderProfilePng({
      title: member?.displayName ?? targetUser.username ?? targetUser.id,
      subtitle: `@${targetUser.username ?? targetUser.id}`,
      avatarUrl: targetUser.displayAvatarURL?.({ extension: 'png', size: 256 }) ?? null,
      stats: [
        { label: t('moderation.user_info.created'), value: new Date(createdSec * 1000).toLocaleDateString('tr-TR') },
        {
          label: t('moderation.user_info.joined'),
          value: joinedSec ? new Date(joinedSec * 1000).toLocaleDateString('tr-TR') : t('common.none'),
        },
        { label: t('moderation.user_info.active_punish'), value: String(active.length) },
        { label: t('moderation.user_info.warnings'), value: String(warnCount) },
        { label: t('moderation.user_info.invites'), value: String(davetSayisi) },
      ],
      accent: getColor('primary'),
    });
    if (png && payloadObj?.components?.[0]?.addMediaGalleryComponents) {
      payloadObj.components[0].addMediaGalleryComponents(gallery([`attachment://${fileName}`]));
      payloadObj.files = [new AttachmentBuilder(png, { name: fileName })];
    }

    await ctx.reply(payloadObj);
  },
};
