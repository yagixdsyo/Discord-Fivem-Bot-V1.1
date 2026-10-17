/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { getGuardConfig } from '../lib/config.js';
import { recordAndLog } from '../lib/pipeline.js';
import { isRaidActive, raidRemainingSec, setRaidActive } from '../lib/raid.js';
import { raidModePayload } from '../lib/view.js';

export default {
  name: 'raid-modu',
  aliases: ['raidmodu'],
  description: 'Raid modunu açar/kapatır veya durumunu gösterir.',
  category: 'Guard',
  system: 'guard',
  cooldown: 5,
  permission: { discord: ['Administrator'] },
  args: [
    {
      name: 'islem',
      type: 'choice',
      required: true,
      description: 'İşlem',
      choices: ['ac', 'kapat', 'durum'].map((value) => ({ name: value, value })),
    },
    { name: 'sure', type: 'integer', required: false, description: 'Süre (dakika, varsayılan 10)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const islem = String(ctx.args.islem ?? 'durum').toLowerCase();
    const config = await getGuardConfig(ctx.guild.id);
    const cfg = config.modules.davet_giris;

    if (islem === 'durum') {
      const active = await isRaidActive(ctx.guild.id);
      const remainingSec = active ? await raidRemainingSec(ctx.guild.id) : 0;
      await ctx.reply(raidModePayload(t, { active, remainingSec, cfg }));
      return;
    }

    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    if (islem === 'ac') {
      const minutes = Math.min(Math.max(Number(ctx.args.sure) || 10, 1), 120);
      const result = await setRaidActive(ctx.guild.id, true, { minutes });
      await recordAndLog({
        guild: ctx.guild,
        moduleKey: 'davet_giris',
        type: 'raid_manual',
        actorId: ctx.user.id,
        actorTag: ctx.user.tag ?? ctx.user.username ?? null,
        description: `Raid modu elle açıldı (**${minutes} dakika**)`,
        action: 'raid_ac',
      });
      await ctx.reply(raidModePayload(t, { active: true, remainingSec: minutes * 60, cfg }));
      return;
    }

    if (islem === 'kapat') {
      await setRaidActive(ctx.guild.id, false);
      await recordAndLog({
        guild: ctx.guild,
        moduleKey: 'davet_giris',
        type: 'raid_manual',
        actorId: ctx.user.id,
        actorTag: ctx.user.tag ?? ctx.user.username ?? null,
        description: 'Raid modu elle kapatıldı',
        action: 'raid_kapat',
      });
      await ctx.reply(raidModePayload(t, { active: false, remainingSec: 0, cfg }));
    }
  },
};
