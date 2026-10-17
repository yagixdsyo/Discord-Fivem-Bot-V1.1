/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { brandFooter, payload, container, row, text, separator, titleLine, selectMenu } from '../../../ui/v2.js';

const APPLICATION_TYPES = [
  { value: 'yetkili', label: 'Yetkili', description: 'Sunucu yetkili basvurusu' },
  { value: 'whitelist', label: 'Whitelist', description: 'Whitelist basvurusu' },
  { value: 'legal_ekip', label: 'Legal Ekip', description: 'Legal ekip basvurusu' },
  { value: 'illegal_ekip', label: 'Illegal Ekip', description: 'Illegal ekip basvurusu' },
];

export default {
  name: 'basvurumesaj',
  aliases: [],
  description: 'Basvuru paneli mesajini kurar.',
  category: 'Basvuru',
  system: 'basvuru',
  cooldown: 10,
  permission: { discord: ['ManageGuild'] },
  args: [],
  async run(ctx) {
    const t = ctx.t;
    const payloadOut = payload({
      components: [container([
        text(titleLine('KULLANICI', t('application.panel_title'))),
        text(t('application.panel_body')),
        separator(),
        row([selectMenu({
          id: 'basvuru:panel',
          placeholder: t('application.panel_placeholder'),
          options: APPLICATION_TYPES.map((item) => ({
            value: item.value,
            label: item.label,
            description: item.description,
            emojiKey: 'BASVURU',
          })),
        })]),
        separator(),
        text(brandFooter(t('application.panel_footer'))),
      ])],
    });
    await ctx.channel.send(payloadOut);
    await ctx.reply(success(t('application.panel_sent_title'), [t('application.panel_sent')]));
  },
};
