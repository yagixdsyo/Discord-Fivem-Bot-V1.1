/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  deleteAnnouncement,
  findByShortId,
  getLatestAnnouncement,
  listAnnouncements,
  setAnnouncementVisible,
} from '../../core/announcements.js';
import { info, panel, success, warn } from '../../ui/templates/index.js';
import { button, row } from '../../ui/v2.js';
import { buildAnnouncementListCard } from './announcementUi.js';
import { auditAction } from './audit.js';
import { ownerConfirm } from './confirm.js';

export function createAnnouncementCommand(kind, { name, aliases = [], description }) {
  return {
    name,
    aliases,
    description,
    category: 'Duyuru',
    subcommands: [
      {
        name: 'yaz',
        description: 'Yeni duyuru yazar (form modal ile).',
        async run(ctx) {
          const t = ctx.t;
          const kindLabel = t(`announce.kind_${kind}`);
          const ownerId = ctx.user.id;

          const card = panel({
            emojiKey: 'DUYURU',
            title: t('announce.write_title', { tur: kindLabel }),
            sections: [t('announce.write_hint')],
            buttons: [
              row([
                button({
                  id: `owner:duyuru:yaz:${kind}:${ownerId}`,
                  label: t('announce.btn_fill'),
                  emojiKey: 'DUZENLE',
                  style: 'primary',
                }),
              ]),
            ],
          });
          await ctx.reply(card);
        },
      },
      {
        name: 'aç',
        aliases: ['ac'],
        description: 'En son duyuruyu yayınlar.',
        async run(ctx) {
          const t = ctx.t;
          const latest = await getLatestAnnouncement(kind);
          if (!latest) {
            await ctx.reply(info(t('owner.no_data'), []));
            return;
          }
          await setAnnouncementVisible(latest._id, true);
          await auditAction({
            config: ctx.config,
            ownerId: ctx.user.id,
            action: `${kind}_duyuru-ac`,
            target: latest.title,
            t,
          });
          await ctx.reply(success(t('announce.turned_on', { baslik: latest.title }), []));
        },
      },
      {
        name: 'kapat',
        description: 'En son duyuruyu gizler.',
        async run(ctx) {
          const t = ctx.t;
          const latest = await getLatestAnnouncement(kind);
          if (!latest) {
            await ctx.reply(info(t('owner.no_data'), []));
            return;
          }
          await setAnnouncementVisible(latest._id, false);
          await auditAction({
            config: ctx.config,
            ownerId: ctx.user.id,
            action: `${kind}_duyuru-kapat`,
            target: latest.title,
            t,
          });
          await ctx.reply(success(t('announce.turned_off', { baslik: latest.title }), []));
        },
      },
      {
        name: 'liste',
        description: 'Son duyuruları listeler.',
        async run(ctx) {
          const t = ctx.t;
          const docs = await listAnnouncements(kind, 10);
          await ctx.reply(buildAnnouncementListCard({ t, kind, docs, ownerId: ctx.user.id }));
        },
      },
      {
        name: 'düzenle',
        aliases: ['duzenle'],
        description: 'Bir duyuruyu düzenler (form modal ile).',
        args: [{ name: 'id', type: 'string', required: true, description: 'Duyuru kısa kimliği' }],
        async run(ctx) {
          const t = ctx.t;
          const short = String(ctx.args.id ?? '').trim().toLowerCase();
          const doc = await findByShortId(kind, short);
          if (!doc) {
            await ctx.reply(info(t('owner.error_not_found', { kod: short }), []));
            return;
          }
          const card = panel({
            emojiKey: 'DUZENLE',
            title: t('announce.edit_title', { baslik: doc.title }),
            sections: [t('announce.write_hint')],
            buttons: [
              row([
                button({
                  id: `owner:duyuru:duzenle:${kind}:${short}:${ctx.user.id}`,
                  label: t('announce.btn_fill'),
                  emojiKey: 'DUZENLE',
                  style: 'primary',
                }),
              ]),
            ],
          });
          await ctx.reply(card);
        },
      },
      {
        name: 'sil',
        description: 'Bir duyuruyu siler (onay gerekir).',
        args: [{ name: 'id', type: 'string', required: true, description: 'Duyuru kısa kimliği' }],
        async run(ctx) {
          const t = ctx.t;
          const short = String(ctx.args.id ?? '').trim().toLowerCase();
          const doc = await findByShortId(kind, short);
          if (!doc) {
            await ctx.reply(info(t('owner.error_not_found', { kod: short }), []));
            return;
          }

          const approved = await ownerConfirm(ctx, {
            title: t('announce.confirm_delete_title'),
            description: [t('announce.confirm_delete_body', { baslik: doc.title })],
            danger: true,
          });
          if (!approved) return;

          await deleteAnnouncement(doc._id);
          await auditAction({
            config: ctx.config,
            ownerId: ctx.user.id,
            action: `${kind}_duyuru-sil`,
            target: short,
            payload: { baslik: doc.title },
            t,
          });
          await ctx.reply(success(t('announce.deleted', { baslik: doc.title }), []));
        },
      },
    ],
  };
}
