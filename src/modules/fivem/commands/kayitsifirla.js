/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { confirm as confirmTemplate, error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { resetByActor } from '../lib/registration.js';
import { runConfirm } from '../../moderation/lib/uiFlow.js';

export default {
  name: 'kayıt-sıfırla',
  aliases: ['kayit-sifirla'],
  description: 'Bir yetkilinin kayıt kayıtlarını sıfırlar (onaylı).',
  category: 'FiveM',
  system: 'kayit',
  cooldown: 10,
  permission: { discord: ['ManageNicknames'] },
  args: [{ name: 'yetkili', type: 'user', required: true, description: 'Kayıtları sıfırlanacak yetkili' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const arg = ctx.args.yetkili;
    const target = arg?.user ?? arg;
    const ownerId = ctx.user.id;

    const preview = confirmTemplate({
      title: t('fivem.kayit.reset_confirm_title'),
      description: [t('fivem.kayit.reset_confirm_body', { kullanici: `<@${target.id}>` }), t('fivem.kayit.reset_confirm_note')],
      confirmId: `kayitsifirlaonay:${ownerId}`,
      cancelId: `kayitsifirlaiptal:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });

    const confirmed = await runConfirm(ctx, {
      payload: preview,
      ownerId,
      confirmId: `kayitsifirlaonay:${ownerId}`,
      cancelId: `kayitsifirlaiptal:${ownerId}`,
    });
    if (!confirmed) return;

    const removed = await resetByActor(ctx.guild.id, target.id);
    await ctx.followUp(
      card({
        emojiKey: 'SIL',
        title: t('fivem.kayit.reset_done_title'),
        lines: [
          t('fivem.kayit.reset_done', { kullanici: `<@${target.id}>`, adet: `**${removed}**` }),
        ],
        accent: 'warn',
      }),
    );
  },
};
