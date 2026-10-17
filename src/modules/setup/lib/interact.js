/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export const STEP_TIMEOUT_MS = 5 * 60_000;
export const MODAL_TIMEOUT_MS = 2 * 60_000;

/**
 * Mesaja bagli ilk etkilesimi bekler (yalnizca sahibinden).
 * @returns {Promise<import('discord.js').MessageComponentInteraction|null>}
 */
export async function waitForInteraction(message, ownerId, { timeMs = STEP_TIMEOUT_MS } = {}) {
  try {
    return await message.awaitMessageComponent({
      filter: (i) => i.user.id === ownerId,
      time: timeMs,
    });
  } catch {
    return null;
  }
}

/**
 * Slash'te otomatik defer devreye girmisse ctx.reply bir Message yerine
 * InteractionResponse donebilir; collector icin gercek mesaji cozer.
 */
export async function ensureMessage(ctx, sent) {
  if (sent && typeof sent.awaitMessageComponent === 'function') return sent;
  if (ctx.interaction) {
    try {
      const fetched = await ctx.interaction.fetchReply();
      if (fetched && typeof fetched.awaitMessageComponent === 'function') return fetched;
    } catch {
      /* yut */
    }
  }
  return sent ?? null;
}

/**
 * Modal gonderimini bekler (mesaja bagli).
 * @returns {Promise<import('discord.js').ModalSubmitInteraction|null>}
 */
export async function waitForModalSubmit(message, { customId, ownerId, timeMs = MODAL_TIMEOUT_MS }) {
  try {
    return await message.awaitModalSubmit({
      filter: (m) => m.customId === customId && m.user.id === ownerId,
      time: timeMs,
    });
  } catch {
    return null;
  }
}
