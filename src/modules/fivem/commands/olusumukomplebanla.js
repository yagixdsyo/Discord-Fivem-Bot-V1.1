/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { confirm as confirmTemplate, error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { progress } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { ensureMessage } from '../../setup/lib/interact.js';
import { runConfirm } from '../../moderation/lib/uiFlow.js';
import { collectRoleMemberIds, getOlusum, recordOlusumBan } from '../lib/olusum.js';

const BATCH_DELAY = 120;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default {
  name: 'oluşumu-komple-banla',
  aliases: ['olusumu-komple-banla'],
  description: 'Bir oluşumun tüm üyelerini toplu banlar (çift onay ister).',
  category: 'FiveM',
  system: null,
  cooldown: 30,
  permission: { discord: ['BanMembers'] },
  args: [
    { name: 'olusum', type: 'string', required: false, description: 'Oluşum adı/ID' },
    { name: 'rol', type: 'role', required: false, description: 'Alternatif: doğrudan rol' },
    { name: 'sebep', type: 'rest', required: false, description: 'Ban sebebi' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    let roleId = ctx.args.rol?.id ?? null;
    let label = ctx.args.rol?.name ?? null;
    let doc = null;

    if (!roleId && ctx.args.olusum) {
      const key = String(ctx.args.olusum).trim();
      doc = (await getOlusum(ctx.guild.id, { olusumId: key })) ?? (await getOlusum(ctx.guild.id, { name: key }));
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

    const sebep = ctx.args.sebep ? String(ctx.args.sebep).trim() : t('fivem.olusum.mass_ban_reason');
    const ownerId = ctx.user.id;

    // 1. onay: kapsam
    const first = confirmTemplate({
      title: t('fivem.olusum.ban_confirm1_title'),
      description: [
        t('fivem.olusum.ban_confirm1_body', { ad: `**${label ?? roleId}**`, adet: `**${ids.length}**` }),
        t('fivem.olusum.ban_confirm1_note', { sebep }),
      ],
      confirmId: `olusumbanonay1:${ownerId}`,
      cancelId: `olusumbaniptal1:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });
    const ok1 = await runConfirm(ctx, {
      payload: first,
      ownerId,
      confirmId: `olusumbanonay1:${ownerId}`,
      cancelId: `olusumbaniptal1:${ownerId}`,
    });
    if (!ok1) return;

    // 2. onay: geri dönüşü olmayan işlem
    const second = confirmTemplate({
      title: t('fivem.olusum.ban_confirm2_title'),
      description: [t('fivem.olusum.ban_confirm2_body', { adet: `**${ids.length}**` }), t('fivem.olusum.ban_confirm2_note')],
      confirmId: `olusumbanonay2:${ownerId}`,
      cancelId: `olusumbaniptal2:${ownerId}`,
      confirmLabel: t('fivem.olusum.ban_confirm2_button'),
      danger: true,
    });
    const ok2 = await runConfirm(ctx, {
      payload: second,
      ownerId,
      confirmId: `olusumbanonay2:${ownerId}`,
      cancelId: `olusumbaniptal2:${ownerId}`,
    });
    if (!ok2) return;

    const loading = await ctx.followUp(
      progress({
        title: t('fivem.olusum.mass_ban_progress_title'),
        done: 0,
        total: ids.length,
        statusText: t('fivem.olusum.mass_ban_progress_text', { ad: label ?? roleId }),
        accent: 'warn',
      }),
      { fetchReply: true },
    );
    const message = await ensureMessage(ctx, loading);

    let banned = 0;
    const failed = [];
    for (const id of ids) {
      try {
        await ctx.guild.members.ban(id, { reason: `Olusum toplu ban (${ctx.user.username}): ${sebep}` });
        banned += 1;
      } catch {
        failed.push(id);
      }
      if ((banned + failed.length) % 10 === 0 || banned + failed.length === ids.length) {
        await message
          ?.edit(
            progress({
              title: t('fivem.olusum.mass_ban_progress_title'),
              done: banned + failed.length,
              total: ids.length,
              statusText: t('fivem.olusum.mass_ban_progress_line', { banlanan: `**${banned}**`, hatali: `**${failed.length}**` }),
              accent: 'warn',
            }),
          )
          .catch(() => {});
      }
      await sleep(BATCH_DELAY);
    }

    const record = await recordOlusumBan({ guildId: ctx.guild.id, olusumId: doc?.olusum_id ?? null, name: label, ids, by: ctx.user.id });

    const files = [];
    if (ids.length > 0) {
      files.push(new AttachmentBuilder(Buffer.from(ids.join('\n'), 'utf8'), { name: `olusum-ban-${record.ban_id}.txt` }));
    }
    if (failed.length > 0) {
      files.push(new AttachmentBuilder(Buffer.from(failed.join('\n'), 'utf8'), { name: `olusum-ban-hatali-${record.ban_id}.txt` }));
    }

    await emitLog(ctx.guild, 'log_olusum_ban_unban', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [
        t('fivem.olusum.log_mass_ban', { ad: `**${label ?? roleId}**`, adet: `**${banned}**`, hatali: `**${failed.length}**` }),
        t('fivem.olusum.log_reason', { sebep }),
      ],
      accent: 'error',
      files,
    });

    await ctx.followUp(
      card({
        emojiKey: 'BAN',
        title: t('fivem.olusum.mass_ban_done_title'),
        lines: [
          t('fivem.olusum.mass_ban_done', { adet: `**${banned}**`, hatali: `**${failed.length}**` }),
          t('fivem.olusum.unban_record_note', { kod: `\`${record.ban_id}\`` }),
        ],
        accent: 'error',
        footer: `\`${record.ban_id}\``,
      }),
    );
  },
};
