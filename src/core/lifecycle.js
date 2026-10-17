/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

let handler = null;

/** Bootstrap tarafindan bir kez kaydedilir. */
export function setLifecycleHandler(fn) {
  handler = fn;
}

/**
 * @param {'stop'|'restart'} mode
 * @param {{ reason?: string|null, by?: string|null }} [meta]
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function requestLifecycle(mode, meta = {}) {
  if (!handler) return { ok: false, error: 'lifecycle_hazir_degil' };
  await handler(mode, meta);
  return { ok: true };
}

export function hasLifecycleHandler() {
  return typeof handler === 'function';
}
