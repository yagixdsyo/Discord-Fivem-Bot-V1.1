/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { list as listTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { runListPager } from '../../moderation/lib/uiFlow.js';
import { getRoleId } from '../lib/maps.js';
import { addReactionRole, listReactionRoles, removeReactionRole } from '../lib/reactions.js';

const PAGE_SIZE = 10;

function toEmojiKey(input) {
  const text = String(input ?? '').trim();
  const custom = text.match(/^<a?:([^:>]+):(\d{15,25})>$/);
  if (custom) return `id:${custom[2]}`;
  if (/^\d{15,25}$/.test(text)) return `id:${text}`;
  return `uni:${text}`;
}

export default {
  name: 'tepki-rol',
  aliases: ['tepkirol'],
  description: 'Mesaj tepkilerine rol/whitelist bağlar.',
  category: 'FiveM',
  system: 'whitelist',
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [
    {
      name: 'islem',
      type: 'choice',
      required: true,
      description: 'İşlem',
      choices: [
        { name: 'Ekle', value: 'ekle' },
        { name: 'Sil', value: 'sil' },
        { name: 'Liste', value: 'liste' },
      ],
    },
    { name: 'kanal', type: 'channel', required: false, description: 'Mesajın kanalı' },
    { name: 'mesajid', type: 'string', required: false, description: 'Mesaj ID' },
    { name: 'emoji', type: 'string', required: false, description: 'Emoji (unicode veya özel emoji)' },
    { name: 'rol', type: 'role', required: false, description: 'Verilecek rol' },
    {
      name: 'tur',
      type: 'choice',
      required: false,
      description: 'Eşleme türü',
      choices: [
        { name: 'Rol', value: 'rol' },
        { name: 'Whitelist', value: 'whitelist' },
      ],
    },
    { name: 'etiket', type: 'string', required: false, description: 'Liste etiketi (açıklama)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const islem = ctx.args.islem;

    if (islem === 'liste') {
      const items = await listReactionRoles(ctx.guild.id, { limit: 200 });
      const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
      const ownerId = ctx.user.id;
      await runListPager(ctx, {
        namespace: 'tepkilist',
        totalPages,
        buildPage: (page) =>
          listTemplate({
            emojiKey: 'YILDIZ',
            title: t('fivem.tepki.list_title'),
            items,
            page,
            pageSize: PAGE_SIZE,
            namespace: 'tepkilist',
            ownerId,
            emptyText: t('fivem.tepki.list_empty'),
            renderItem: (doc) =>
              t('fivem.tepki.list_line', {
                kanal: `<#${doc.channel_id}>`,
                mesaj: `\`${doc.message_id}\``,
                emoji: doc.emoji_key.startsWith('id:') ? `<:e:${doc.emoji_key.slice(3)}>` : doc.emoji_key.slice(4),
                rol: doc.mode === 'whitelist' ? t('fivem.tepki.wh_mode') : `<@&${doc.role_id}>`,
              }),
          }),
      });
      return;
    }

    const channel = ctx.args.kanal;
    const messageId = ctx.args.mesajid ? String(ctx.args.mesajid).trim() : null;
    const emojiInput = ctx.args.emoji ? String(ctx.args.emoji).trim() : null;
    if (!channel || !messageId || !emojiInput) {
      await ctx.reply(errorTemplate(t('fivem.tepki.input_missing_title'), [t('fivem.tepki.input_missing')]));
      return;
    }

    const emojiKey = toEmojiKey(emojiInput);

    if (islem === 'sil') {
      const removed = await removeReactionRole(ctx.guild.id, { messageId, emojiKey });
      if (!removed) {
        await ctx.reply(errorTemplate(t('fivem.tepki.not_found_title'), [t('fivem.tepki.not_found')]));
        return;
      }
      await ctx.reply(success(t('fivem.tepki.removed_title'), [t('fivem.tepki.removed')]));
      return;
    }

    // ekle
    const mode = ctx.args.tur ?? 'rol';
    let roleId = ctx.args.rol?.id ?? null;
    if (mode === 'whitelist') {
      roleId = await getRoleId(ctx.guild.id, 'whitelist');
      if (!roleId) {
        await ctx.reply(errorTemplate(t('fivem.tepki.wh_role_missing_title'), [t('fivem.tepki.wh_role_missing')]));
        return;
      }
    }
    if (!roleId) {
      await ctx.reply(errorTemplate(t('fivem.tepki.role_required_title'), [t('fivem.tepki.role_required')]));
      return;
    }

    const message = await channel.messages?.fetch(messageId).catch(() => null);
    if (!message) {
      await ctx.reply(errorTemplate(t('fivem.tepki.message_missing_title'), [t('fivem.tepki.message_missing')]));
      return;
    }

    const reacted = await message.react(emojiInput).then(() => true).catch(() => false);
    if (!reacted) {
      await ctx.reply(errorTemplate(t('fivem.tepki.emoji_invalid_title'), [t('fivem.tepki.emoji_invalid')]));
      return;
    }

    const result = await addReactionRole({
      guildId: ctx.guild.id,
      channelId: channel.id,
      messageId,
      emojiKey,
      roleId,
      mode,
      label: ctx.args.etiket ? String(ctx.args.etiket).trim() : null,
    });

    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.tepki.duplicate_title'), [t('fivem.tepki.duplicate')]));
      return;
    }

    await emitLog(ctx.guild, 'log_rol_ver_al', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [
        t('fivem.tepki.log_added', {
          kanal: `<#${channel.id}>`,
          mesaj: `\`${messageId}\``,
          rol: mode === 'whitelist' ? t('fivem.tepki.wh_mode') : `<@&${roleId}>`,
        }),
      ],
      accent: 'info',
    });

    await ctx.reply(
      success(t('fivem.tepki.added_title'), [
        t('fivem.tepki.added', {
          kanal: `<#${channel.id}>`,
          mesaj: `\`${messageId}\``,
          rol: mode === 'whitelist' ? t('fivem.tepki.wh_mode') : `<@&${roleId}>`,
        }),
      ]),
    );
  },
};
