/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { card } from '../../../ui/templates/base.js';
import { getColor } from '../../../ui/colors.js';
import { pageButtons } from '../../../ui/paginator.js';
import { renderDonatePng } from '../../../ui/canvas/donate.js';
import { runListPager } from '../../moderation/lib/uiFlow.js';
import { getDonateInfo, listDonates } from '../lib/donate.js';
import { buildDonatePages } from '../lib/donatePages.js';

const NAMESPACE = 'donateinfo';

export default {
  name: 'donate-bilgi',
  aliases: ['donatebilgi'],
  description: 'Donate paketlerini, yöntemleri ve iletişimi 6 sayfalık rehberde gösterir.',
  category: 'FiveM',
  system: null,
  cooldown: 10,
  permission: { discord: [] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    const info = await getDonateInfo(ctx.guild.id);
    const donates = await listDonates(ctx.guild.id, { limit: 100 }).catch(() => []);

    const defs = buildDonatePages(t, { info, donates });
    const ownerId = ctx.user.id;

    // Canvas'lari onceden uret: sayfa gecisleri aninda olsun.
    const pages = [];
    for (let index = 0; index < defs.length; index += 1) {
      const def = defs[index];
      const fileName = `donate-sayfa-${index + 1}.png`;
      const png = await renderDonatePng({
        ...def.canvas,
        page: { index: index + 1, total: defs.length },
        accent: getColor(def.accent ?? 'success'),
      });
      pages.push(
        card({
          emojiKey: 'DONATE',
          title: def.cardTitle,
          subtitle: def.cardSubtitle,
          lines: png ? [] : def.lines,
          accent: def.accent,
          imageUrls: png ? [`attachment://${fileName}`] : [],
          files: png ? [new AttachmentBuilder(png, { name: fileName })] : [],
          buttons: [pageButtons({ namespace: NAMESPACE, page: index, totalPages: defs.length, ownerId })],
          footer: png ? t('fivem.donate.page_canvas_footer', { sayfa: `${index + 1}/${defs.length}` }) : null,
        }),
      );
    }

    await runListPager(ctx, {
      namespace: NAMESPACE,
      totalPages: defs.length,
      buildPage: (page) => pages[Math.max(0, Math.min(page, pages.length - 1))],
    });
  },
};
