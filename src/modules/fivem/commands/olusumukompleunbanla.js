/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { confirm as confirmTemplate, error as errorTemplate, progress } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { emitLog } from '../../logging/lib/emit.js';
import { ensureMessage } from '../../setup/lib/interact.js';
import { runConfirm } from '../../moderation/lib/uiFlow.js';
import { getLatestOlusumBan, getOlusum, markOlusumBanUnbanned } from '../lib/olusum.js';

const BATCH_DELAY = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default {
  name: 'oluşumu-komple-unbanla',
  aliases: ['olusumu-komple-unbanla'],
  description: 'Bir oluşumun son toplu banını geri açar.',
  category: 'FiveM',
  system: null,
  cooldown: 30,
  permission: { discord: ['BanMembers'] },
  args: [{ name: 'olusum', type: 'string', required: true, description: 'Oluşum adı/ID' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const key = String(ctx.args.olusum ?? '').trim();
    const doc = (await getOlusum(ctx.guild.id, { olusumId: key })) ?? (await getOlusum(ctx.guild.id, { name: key }));
    if (!doc) {
      await ctx.reply(errorTemplate(t('fivem.olusum.not_found_title'), [t('fivem.olusum.not_found', { olusum: key })]));
      return;
    }

    const record = await getLatestOlusumBan(ctx.guild.id, { olusumId: doc.olusum_id });
    if (!record) {
      await ctx.reply(errorTemplate(t('fivem.olusum.no_ban_record_title'), [t('fivem.olusum.no_ban_record', { ad: `**${doc.name}**` })]));
      return;
    }

    const ownerId = ctx.user.id;
    const payload = confirmTemplate({
      title: t('fivem.olusum.unban_confirm_title'),
      description: [
        t('fivem.olusum.unban_confirm_body', { ad: `**${doc.name}**`, adet: `**${record.count}**` }),
        t('fivem.olusum.unban_confirm_date', {
          tarih: `<t:${Math.floor(Date.parse(record.created_at) / 1000)}:R>`,
        }),
      ],
      confirmId: `olusumunbanonay:${ownerId}`,
      cancelId: `olusumunbaniptal:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });
    const confirmed = await runConfirm(ctx, {
      payload,
      ownerId,
      confirmId: `olusumunbanonay:${ownerId}`,
      cancelId: `olusumunbaniptal:${ownerId}`,
    });
    if (!confirmed) return;

    const loading = await ctx.followUp(
      progress({
        title: t('fivem.olusum.mass_unban_progress_title'),
        done: 0,
        total: record.ids.length,
        statusText: t('fivem.olusum.mass_unban_progress_text', { ad: `**${doc.name}**` }),
        accent: 'primary',
      }),
      { fetchReply: true },
    );
    const message = await ensureMessage(ctx, loading);

    let unbanned = 0;
    const failed = [];
    for (const id of record.ids) {
      try {
        await ctx.guild.bans.remove(id, `Olusum toplu unban (${ctx.user.username})`);
        unbanned += 1;
      } catch {
        failed.push(id);
      }
      if ((unbanned + failed.length) % 10 === 0 || unbanned + failed.length === record.ids.length) {
        await message
          ?.edit(
            progress({
              title: t('fivem.olusum.mass_unban_progress_title'),
              done: unbanned + failed.length,
              total: record.ids.length,
              statusText: t('fivem.olusum.mass_unban_progress_line', { acilan: `**${unbanned}**`, hatali: `**${failed.length}**` }),
              accent: 'primary',
            }),
          )
          .catch(() => {});
      }
      await sleep(BATCH_DELAY);
    }

    await markOlusumBanUnbanned(ctx.guild.id, record.ban_id, ctx.user.id);

    const files = failed.length > 0 ? [new AttachmentBuilder(Buffer.from(failed.join('\n'), 'utf8'), { name: `olusum-unban-hatali-${record.ban_id}.txt` })] : [];

    await emitLog(ctx.guild, 'log_olusum_ban_unban', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [t('fivem.olusum.log_mass_unban', { ad: `**${doc.name}**`, adet: `**${unbanned}**`, hatali: `**${failed.length}**` })],
      accent: 'success',
      files,
    });

    await ctx.followUp(
      card({
        emojiKey: 'UNBAN',
        title: t('fivem.olusum.mass_unban_done_title'),
        lines: [
          t('fivem.olusum.mass_unban_done', { adet: `**${unbanned}**`, hatali: `**${failed.length}**` }),
          t('fivem.olusum.unban_access_note'),
        ],
        accent: 'success',
        footer: `\`${record.ban_id}\``,
      }),
    );
  },
};
