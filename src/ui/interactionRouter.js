/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

const handlers = new Map();

/**
 * @param {string} prefix customId'nin ilk parcasi (genelde modul id)
 * @param {(interaction: import('discord.js').Interaction, rest: string[]) => Promise<void>} handler
 */
export function registerComponentHandler(prefix, handler) {
  handlers.set(prefix, handler);
}

export function hasComponentHandler(prefix) {
  return handlers.has(prefix);
}

export function listComponentPrefixes() {
  return [...handlers.keys()];
}

/** Test/temizlik icin. */
export function resetComponentHandlers() {
  handlers.clear();
}

/**
 * Bilesen/modal etkilesimini uygun handler'a yonlendirir.
 * @returns {Promise<boolean>} true = islendi
 */
export async function routeComponentInteraction(interaction) {
  const customId = typeof interaction.customId === 'string' ? interaction.customId : null;
  if (!customId) return false;

  const parts = customId.split(':');
  const prefix = parts[0];
  const handler = handlers.get(prefix);
  if (!handler) return false;

  await handler(interaction, parts.slice(1));
  return true;
}
