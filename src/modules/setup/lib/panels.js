/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

const panels = new Map();

export function registerSetupPanel(def) {
  if (!def?.key || typeof def.build !== 'function') return;
  panels.set(def.key, def);
}

export function listSetupPanels() {
  return [...panels.values()];
}

/** Test izolasyonu icin. */
export function clearSetupPanels() {
  panels.clear();
}

/**
 * Kayitli tum panelleri idempotent sekilde gonderir.
 * - Kanal eslemesi yoksa atlanir (paket secilmediyse normal).
 * - panel_messages kaydi varsa ve mesaj duruyorsa tekrar gonderilmez.
 * @returns {{posted: number, skipped: number, errors: Array<{key: string, error: string}>}}
 */
export async function postRegisteredPanels(guild, { store } = {}) {
  const result = { posted: 0, skipped: 0, errors: [] };
  const defs = listSetupPanels();
  if (defs.length === 0) return result;

  let panelDocs = [];
  const channelKeys = new Map();
  if (store) {
    try {
      panelDocs = await store.getMap('panel_messages', guild.id);
      const channelDocs = await store.getMap('channels_map', guild.id);
      for (const doc of channelDocs) channelKeys.set(doc.key, doc.channel_id);
    } catch {
      /* store hatasi: paneller atlanir */
    }
  }
  const byKey = new Map(panelDocs.map((d) => [d.key, d]));

  for (const def of defs) {
    const channelId = def.channelKey ? channelKeys.get(def.channelKey) : null;
    if (!channelId) {
      result.skipped += 1;
      continue;
    }

    const existing = byKey.get(def.key);
    if (existing?.message_id) {
      let alive = null;
      try {
        const channel =
          guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
        if (channel?.messages?.fetch) alive = await channel.messages.fetch(existing.message_id).catch(() => null);
      } catch {
        alive = null;
      }
      if (alive) {
        result.skipped += 1;
        continue;
      }
    }

    try {
      const channel =
        guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
      if (!channel) throw new Error('kanal_bulunamadi');
      const payload = await def.build({ guild });
      const message = await channel.send(payload);
      if (store) {
        await store.setMap('panel_messages', {
          guild_id: guild.id,
          key: def.key,
          channel_id: channelId,
          message_id: message.id,
          at: new Date().toISOString(),
        });
      }
      if (typeof def.afterPost === 'function') {
        try {
          await def.afterPost({ guild, channel, message, store });
        } catch (err) {
          result.errors.push({ key: def.key, error: String(err?.message ?? err) });
        }
      }
      result.posted += 1;
    } catch (err) {
      result.errors.push({ key: def.key, error: String(err?.message ?? err) });
    }
  }

  return result;
}
