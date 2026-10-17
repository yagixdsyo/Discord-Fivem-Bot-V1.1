/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { parsePageCustomId } from '../../../ui/paginator.js';
import { disabledCard } from '../../../ui/templates/base.js';
import { ensureMessage, waitForInteraction } from '../../setup/lib/interact.js';

/**
 * Onay dongusu.
 * @returns {Promise<object|null>} onay etkilesimi veya null (iptal/zaman asimi)
 */
export async function runConfirm(ctx, { payload, ownerId, confirmId, cancelId, onCancel = null }) {
  const message = await ensureMessage(ctx, await ctx.reply(payload, { fetchReply: true }));
  if (!message || typeof message.awaitMessageComponent !== 'function') return null;

  for (;;) {
    const interaction = await waitForInteraction(message, ownerId);
    if (!interaction) {
      await message.edit(disabledCard(payload)).catch(() => {});
      return null;
    }
    if (interaction.customId === confirmId) {
      await interaction.deferUpdate().catch(() => {});
      return interaction;
    }
    if (interaction.customId === cancelId) {
      const card = onCancel ? onCancel() : disabledCard(payload);
      await interaction.update(card).catch(() => {});
      return null;
    }
    await interaction.deferUpdate().catch(() => {});
  }
}

/**
 * @param {object} ctx komut baglami
 * @param {{buildPage: (page: number) => object, totalPages: number, namespace: string, startPage?: number}} opts
 */
export async function runListPager(ctx, { buildPage, totalPages, namespace, startPage = 0 }) {
  const maxPage = Math.max(0, totalPages - 1);
  let page = Math.max(0, Math.min(startPage, maxPage));

  const build = (target) => {
    const result = buildPage(target);
    return result?.payload ?? result;
  };

  let last = build(page);
  const message = await ctx.reply(last, { fetchReply: true });
  if (!message || typeof message.awaitMessageComponent !== 'function') return;
  if (totalPages <= 1) return;

  for (;;) {
    const interaction = await waitForInteraction(message, ctx.user.id);
    if (!interaction) {
      await message.edit(disabledCard(last)).catch(() => {});
      return;
    }
    const parsed = parsePageCustomId(interaction.customId);
    if (!parsed || parsed.namespace !== namespace) {
      await interaction.deferUpdate().catch(() => {});
      continue;
    }
    page = Math.max(0, Math.min(parsed.page, maxPage));
    last = build(page);
    await interaction.update(last).catch(() => {});
  }
}
