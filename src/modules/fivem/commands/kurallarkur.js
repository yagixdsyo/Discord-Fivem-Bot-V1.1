/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { getChannelId } from '../lib/maps.js';
import { parseRules, setRules } from '../lib/rules.js';
import { rulesPayload } from '../lib/view.js';
import { rulesSelectRow } from './kurallar.js';

export default {
  name: 'kurallar-kur',
  aliases: ['kurallarkur'],
  description: 'Kuralları kaydeder; "# Başlık" satırları sayfa başlatır.',
  category: 'FiveM',
  system: null,
  cooldown: 10,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'kanal', type: 'channel', required: false, description: 'Yayınlanacak kanal (varsayılan: kurallar)' },
    { name: 'metin', type: 'rest', required: true, description: 'Kural metni ("# Başlık" yeni sayfa açar)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const text = String(ctx.args.metin ?? '').trim();
    if (!text) {
      await ctx.reply(errorTemplate(t('fivem.rules.empty_title'), [t('fivem.rules.empty')]));
      return;
    }

    const pages = parseRules(text);
    if (pages.length === 0) {
      await ctx.reply(errorTemplate(t('fivem.rules.parse_fail_title'), [t('fivem.rules.parse_fail')]));
      return;
    }

    await setRules(ctx.guild.id, pages);

    let posted = false;
    const channelId = ctx.args.kanal?.id ?? (await getChannelId(ctx.guild.id, 'kurallar'));
    if (channelId) {
      const channel = ctx.guild.channels.cache.get(channelId) ?? (await ctx.guild.channels.fetch(channelId).catch(() => null));
      if (channel && typeof channel.send === 'function') {
        const selectRow = pages.length > 1 ? rulesSelectRow(t, pages) : null;
        posted = await channel
          .send(rulesPayload(t, { pages, index: 0, selectRow }))
          .then(() => true)
          .catch(() => false);
      }
    }

    await ctx.reply(
      success(t('fivem.rules.saved_title'), [
        t('fivem.rules.saved', { sayfa: `**${pages.length}**` }),
        posted ? t('fivem.rules.posted') : t('fivem.rules.not_posted'),
      ]),
    );
  },
};
