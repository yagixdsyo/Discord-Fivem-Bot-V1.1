/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { collectRoleMemberIds, getOlusum } from '../lib/olusum.js';

const PREVIEW = 40;

export default {
  name: 'oluşum-idleri-at',
  aliases: ['olusum-idleri-at'],
  description: 'Bir oluşumun (veya rolün) üye ID listesini çıkarır ve dosya olarak gönderir.',
  category: 'FiveM',
  system: null,
  cooldown: 15,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'olusum', type: 'string', required: false, description: 'Oluşum adı/ID' },
    { name: 'rol', type: 'role', required: false, description: 'Alternatif: doğrudan rol' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    let roleId = ctx.args.rol?.id ?? null;
    let label = ctx.args.rol?.name ?? null;

    if (!roleId && ctx.args.olusum) {
      const key = String(ctx.args.olusum).trim();
      const doc = (await getOlusum(ctx.guild.id, { olusumId: key })) ?? (await getOlusum(ctx.guild.id, { name: key }));
      if (!doc) {
        await ctx.reply(errorTemplate(t('fivem.olusum.not_found_title'), [t('fivem.olusum.not_found', { olusum: key })]));
        return;
      }
      roleId = doc.role_id;
      label = doc.name;
    }

    if (!roleId) {
      await ctx.reply(errorTemplate(t('fivem.olusum.input_missing_title'), [t('fivem.olusum.input_missing')]));
      return;
    }

    const ids = await collectRoleMemberIds(ctx.guild, roleId);
    if (ids.length === 0) {
      await ctx.reply(errorTemplate(t('fivem.olusum.no_members_title'), [t('fivem.olusum.no_members')]));
      return;
    }

    const preview = ids.slice(0, PREVIEW).map((id) => `\`${id}\``).join('\n');
    const file = new AttachmentBuilder(Buffer.from(ids.join('\n'), 'utf8'), {
      name: `olusum-idler-${(label ?? roleId).replace(/[^a-z0-9_-]+/gi, '_').slice(0, 40)}.txt`,
    });

    await ctx.reply(
      card({
        emojiKey: 'ID',
        title: t('fivem.olusum.ids_title', { ad: label ?? roleId }),
        lines: [
          t('fivem.olusum.ids_count', { adet: `**${ids.length}**` }),
          ids.length > PREVIEW ? t('fivem.olusum.ids_preview_more', { adet: PREVIEW }) : null,
          preview,
        ].filter(Boolean),
        accent: 'primary',
        files: [file],
      }),
    );
  },
};
