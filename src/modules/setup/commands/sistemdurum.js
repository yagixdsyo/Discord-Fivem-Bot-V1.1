/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { disabledCard } from '../../../ui/templates/base.js';
import { error as errorTemplate } from '../../../ui/templates/index.js';
import { parsePageCustomId } from '../../../ui/paginator.js';
import { waitForInteraction } from '../lib/interact.js';
import { listGuildSystems, resolveSystem } from '../lib/systems.js';
import { applySystemToggle } from '../lib/toggle.js';
import { DURUM_PAGE_SIZE, durumPayload, guardConfirmPayload } from '../lib/view.js';

function clampPage(page, count) {
  const totalPages = Math.max(1, Math.ceil(count / DURUM_PAGE_SIZE));
  return Math.min(Math.max(0, Number(page) || 0), totalPages - 1);
}

export default {
  name: 'sistemdurum',
  aliases: ['sistem-durum', 'sistemler'],
  description: 'Sistemlerin açık/kapalı durumunu gösterir; butonlarla değiştirmenizi sağlar.',
  category: 'Sistem',
  cooldown: 5,
  permission: { discord: ['Administrator'] },
  args: [],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const ownerId = ctx.user.id;
    let systems = await listGuildSystems(ctx.guild.id);
    let page = 0;

    const buildPage = (targetPage) => durumPayload(t, { systems, page: targetPage, ownerId }).payload;

    let lastPayload = buildPage(page);
    const message = await ctx.reply(lastPayload, { fetchReply: true });
    if (!message || typeof message.awaitMessageComponent !== 'function') return;

    for (;;) {
      const interaction = await waitForInteraction(message, ownerId);
      if (!interaction) {
        await message.edit(disabledCard(lastPayload)).catch(() => {});
        return;
      }

      const parts = interaction.customId.split(':');

      // Sayfalama
      if (parts[0] === 'ui' && parts[1] === 'pg') {
        const parsed = parsePageCustomId(interaction.customId);
        if (!parsed || parsed.namespace !== 'setupdurum') {
          await interaction.deferUpdate().catch(() => {});
          continue;
        }
        page = clampPage(parsed.page, systems.length);
        lastPayload = buildPage(page);
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      // Durumu yenile
      if (parts[1] === 'yenile') {
        systems = await listGuildSystems(ctx.guild.id);
        page = clampPage(parts[2] ?? page, systems.length);
        lastPayload = buildPage(page);
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      // Toggle
      if (parts[1] === 'tgl') {
        const systemId = parts[2];
        const fromPage = clampPage(parts[3] ?? 0, systems.length);
        const system = systems.find((s) => s.id === systemId) ?? resolveSystem(systemId);
        if (!system) {
          await interaction.deferUpdate().catch(() => {});
          continue;
        }

        if (system.id === 'guard' && system.enabled) {
          lastPayload = guardConfirmPayload(t, { system, page: fromPage, ownerId });
          await interaction.update(lastPayload).catch(() => {});
          continue;
        }

        const result = await applySystemToggle(ctx, { system, enabled: !system.enabled });
        systems = await listGuildSystems(ctx.guild.id);
        page = fromPage;
        lastPayload = result.ok
          ? buildPage(page)
          : errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]);
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      // Guard kapatma onayi
      if (parts[1] === 'guard-onay') {
        const system = resolveSystem(parts[2]);
        const fromPage = clampPage(parts[3] ?? 0, systems.length);
        if (!system) {
          await interaction.deferUpdate().catch(() => {});
          continue;
        }
        const result = await applySystemToggle(ctx, { system, enabled: false });
        systems = await listGuildSystems(ctx.guild.id);
        page = fromPage;
        lastPayload = result.ok
          ? buildPage(page)
          : errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]);
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      // Guard onayindan geri don
      if (parts[1] === 'geri') {
        page = clampPage(parts[2] ?? 0, systems.length);
        lastPayload = buildPage(page);
        await interaction.update(lastPayload).catch(() => {});
        continue;
      }

      await interaction.deferUpdate().catch(() => {});
    }
  },
};
