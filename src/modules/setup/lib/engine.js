/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ChannelType } from 'discord.js';
import { SETUP_VERSION } from './catalog.js';
import { createDbStore } from './store.js';
import { postRegisteredPanels } from './panels.js';

export const SETUP_PHASES = ['roller', 'kategoriler', 'kanallar', 'ayarlar', 'paneller'];
export const RESET_PHASES = ['kanallar', 'roller', 'kayitlar'];

const REASON_SETUP = 'Sistem kurulumu (/sistemkur)';
const REASON_RESET = 'Kurulum sifirlama (/sistemkur sıfırla)';

/** Katalog overwrite tanimini Discord bicimine cevirir. */
export function buildOverwrites(overwrites, roleIdByKey, guildId) {
  if (!overwrites) return undefined;
  const list = [];
  for (const [key, value] of Object.entries(overwrites)) {
    const id = key === 'everyone' ? guildId : roleIdByKey.get(key);
    if (!id) continue;
    list.push({ id, allow: value.allow ?? [], deny: value.deny ?? [] });
  }
  return list.length > 0 ? list : undefined;
}

function errorText(err) {
  return String(err?.message ?? err);
}

/**
 * Kurulumu uygular (idempotent).
 * @param {import('discord.js').Guild} guild
 * @param {{plan: object, store?: object, onProgress?: Function}} opts
 */
export async function runSetup(guild, { plan, store = createDbStore(), onProgress = () => {} } = {}) {
  const result = {
    roles: { created: 0, adopted: 0, reused: 0 },
    categories: { created: 0, reused: 0 },
    channels: { created: 0, reused: 0, moved: 0 },
    panels: { posted: 0, skipped: 0, errors: [] },
    settings: { written: 0 },
    errors: [],
  };

  const total = SETUP_PHASES.length;
  const report = (index) => onProgress({ index, total, phase: SETUP_PHASES[Math.min(index, total - 1)], result });

  // ------------------------------------------------------------------
  // 1) Roller
  // ------------------------------------------------------------------
  report(0);
  const roleDocs = new Map((await store.getMap('roles_map', guild.id)).map((d) => [d.key, d]));
  const roleIdByKey = new Map();
  const roleObjByKey = new Map();

  for (const spec of plan.roles ?? []) {
    const doc = roleDocs.get(spec.key);
    let role = doc?.role_id ? guild.roles.cache.get(doc.role_id) ?? null : null;

    if (!role) {
      const byName = guild.roles.cache.find((r) => r.name === spec.name) ?? null;
      if (byName) {
        role = byName;
        result.roles.adopted += 1;
      }
    }

    if (!role) {
      try {
        role = await guild.roles.create({
          name: spec.name,
          color: spec.color,
          hoist: Boolean(spec.hoist),
          mentionable: Boolean(spec.mentionable),
          permissions: spec.permissions ?? [],
          reason: REASON_SETUP,
        });
        result.roles.created += 1;
      } catch (err) {
        result.errors.push({ step: 'roller', key: spec.key, error: errorText(err) });
        continue;
      }
    } else if (doc?.role_id === role.id) {
      result.roles.reused += 1;
    }

    roleIdByKey.set(spec.key, role.id);
    roleObjByKey.set(spec.key, role);

    if (!doc || doc.role_id !== role.id) {
      try {
        await store.setMap('roles_map', { guild_id: guild.id, key: spec.key, role_id: role.id });
      } catch (err) {
        result.errors.push({ step: 'roller', key: spec.key, error: errorText(err) });
      }
    }
  }

  // Hiyerarsi: roller botun en ust rolunun ALTINA, tanim sirasiyla yerlestirilir.
  const me = guild.members?.me ?? null;
  if (me?.roles?.highest && typeof guild.roles.setPositions === 'function' && (plan.roles?.length ?? 0) > 0) {
    try {
      let position = me.roles.highest.position - 1;
      const pairs = [];
      for (const spec of plan.roles) {
        const role = roleObjByKey.get(spec.key);
        if (!role) continue;
        if (position < 1) break;
        if (role.position !== position) pairs.push({ role, position });
        position -= 1;
      }
      if (pairs.length > 0) await guild.roles.setPositions(pairs);
    } catch (err) {
      result.errors.push({ step: 'roller', key: 'hiyerarsi', error: errorText(err) });
    }
  }

  // ------------------------------------------------------------------
  // 2) Kategoriler
  // ------------------------------------------------------------------
  report(1);
  const channelDocs = new Map((await store.getMap('channels_map', guild.id)).map((d) => [d.key, d]));
  const categoryIdByKey = new Map();

  for (const spec of plan.categories ?? []) {
    const doc = channelDocs.get(spec.key);
    let channel = doc?.channel_id ? guild.channels.cache.get(doc.channel_id) ?? null : null;

    if (!channel) {
      try {
        channel = await guild.channels.create({
          name: spec.name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: buildOverwrites(spec.overwrites, roleIdByKey, guild.id),
          reason: REASON_SETUP,
        });
        result.categories.created += 1;
      } catch (err) {
        result.errors.push({ step: 'kategoriler', key: spec.key, error: errorText(err) });
        continue;
      }
    } else {
      result.categories.reused += 1;
    }

    categoryIdByKey.set(spec.key, channel.id);
    if (!doc || doc.channel_id !== channel.id) {
      try {
        await store.setMap('channels_map', {
          guild_id: guild.id,
          key: spec.key,
          channel_id: channel.id,
          category_id: null,
        });
      } catch (err) {
        result.errors.push({ step: 'kategoriler', key: spec.key, error: errorText(err) });
      }
    }
  }

  // ------------------------------------------------------------------
  // 3) Kanallar
  // ------------------------------------------------------------------
  report(2);

  for (const spec of plan.channels ?? []) {
    const doc = channelDocs.get(spec.key);
    let channel = doc?.channel_id ? guild.channels.cache.get(doc.channel_id) ?? null : null;
    const parentId = categoryIdByKey.get(spec.category) ?? null;

    if (!channel) {
      if (!parentId) {
        result.errors.push({ step: 'kanallar', key: spec.key, error: 'kategori_yok' });
        continue;
      }
      try {
        channel = await guild.channels.create({
          name: spec.name,
          type: spec.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
          parent: parentId,
          permissionOverwrites: buildOverwrites(spec.overwrites, roleIdByKey, guild.id),
          ...(spec.userLimit ? { userLimit: spec.userLimit } : {}),
          ...(spec.topic ? { topic: spec.topic } : {}),
          reason: REASON_SETUP,
        });
        result.channels.created += 1;
      } catch (err) {
        result.errors.push({ step: 'kanallar', key: spec.key, error: errorText(err) });
        continue;
      }
    } else {
      result.channels.reused += 1;
      // Onarim: kategori silinip yeniden olusturulduysa kanali geri tasi.
      const currentParent = channel.parentId ?? channel.parent?.id ?? null;
      if (parentId && currentParent !== parentId && typeof channel.setParent === 'function') {
        try {
          await channel.setParent(parentId, { lockPermissions: false, reason: REASON_SETUP });
          result.channels.moved += 1;
        } catch (err) {
          result.errors.push({ step: 'kanallar', key: spec.key, error: errorText(err) });
        }
      }
    }

    if (!doc || doc.channel_id !== channel.id) {
      try {
        await store.setMap('channels_map', {
          guild_id: guild.id,
          key: spec.key,
          channel_id: channel.id,
          category_id: parentId,
        });
      } catch (err) {
        result.errors.push({ step: 'kanallar', key: spec.key, error: errorText(err) });
      }
    }
  }

  // ------------------------------------------------------------------
  // 4) Ayarlar + setup_done
  // ------------------------------------------------------------------
  report(3);
  const settings = plan.settings ?? {};
  const writes = [['setup.packages', settings.packages ?? []], ['setup.version', SETUP_VERSION], ['setup.at', new Date().toISOString()]];
  if (settings.cfxCode) writes.push(['fivem.cfx_code', settings.cfxCode]);
  if (settings.serverIp) writes.push(['fivem.server_ip', settings.serverIp]);
  if (settings.otoRolId) writes.push(['roles.oto_rol', settings.otoRolId]);
  if (settings.yetkiliRolId) writes.push(['roles.yetkili_ekip', settings.yetkiliRolId]);

  for (const [key, value] of writes) {
    try {
      await store.setSetting(guild.id, key, value);
      result.settings.written += 1;
    } catch (err) {
      result.errors.push({ step: 'ayarlar', key, error: errorText(err) });
    }
  }

  try {
    await store.markSetupDone(guild.id, true);
  } catch (err) {
    result.errors.push({ step: 'ayarlar', key: 'setup_done', error: errorText(err) });
  }
  await store.invalidateGuild(guild.id);

  // ------------------------------------------------------------------
  // 5) Paneller
  // ------------------------------------------------------------------
  report(4);
  try {
    result.panels = await postRegisteredPanels(guild, { store });
    for (const panelError of result.panels.errors ?? []) {
      result.errors.push({ step: 'paneller', key: panelError.key, error: panelError.error });
    }
  } catch (err) {
    result.errors.push({ step: 'paneller', key: '-', error: errorText(err) });
  }

  report(total);
  return result;
}

/**
 * Sunucu yapisini siler.
 * TUM kanallar (kategoriler dahil) ve silinebilir TUM roller silinir;
 * keepChannelIds icindeki kanallar korunur (owner kanali + komut kanali).
 * Eslemeler, panel kayitlari ve setup_done temizlenir; kullanici verisi
 * (cezalar, kayitlar, ayarlar) korunur.
 *
 * @param {import('discord.js').Guild} guild
 * @param {{store?: object, onProgress?: Function, keepChannelIds?: string[]}} [opts]
 */
export async function runReset(guild, { store = createDbStore(), onProgress = () => {}, keepChannelIds = [] } = {}) {
  const result = { deletedChannels: 0, deletedRoles: 0, keptChannels: 0, skippedRoles: [], errors: [] };
  const keep = new Set((keepChannelIds ?? []).filter(Boolean));
  const total = RESET_PHASES.length;
  const report = (index) => onProgress({ index, total, phase: RESET_PHASES[Math.min(index, total - 1)], result });

  // 1) Kanallar: TUM kanallar silinir (kategoriler en sona); korunanlar atlanir.
  report(0);
  let channels = [...guild.channels.cache.values()];
  if (typeof guild.channels.fetch === 'function') {
    try {
      const fetched = await guild.channels.fetch();
      if (fetched?.size) channels = [...fetched.values()];
    } catch {
      /* onbellekten devam */
    }
  }
  const ordered = channels.sort(
    (a, b) => (a.type === ChannelType.GuildCategory ? 1 : 0) - (b.type === ChannelType.GuildCategory ? 1 : 0),
  );
  for (const channel of ordered) {
    if (keep.has(channel.id)) {
      result.keptChannels += 1;
      continue;
    }
    try {
      await channel.delete(REASON_RESET);
      result.deletedChannels += 1;
    } catch (err) {
      result.errors.push({ step: 'kanallar', key: channel.id, error: errorText(err) });
    }
  }

  // 2) Roller: @everyone, yonetilen roller ve bot hiyerarsisinin ustu haric hepsi.
  report(1);
  const everyoneId = guild.roles?.everyone?.id ?? guild.id;
  const botHighest = guild.members?.me?.roles?.highest?.position;
  for (const role of [...guild.roles.cache.values()]) {
    if (role.id === everyoneId) continue;
    if (role.managed) {
      result.skippedRoles.push({ key: role.name ?? role.id, reason: 'yonetilen_rol' });
      continue;
    }
    if (typeof botHighest === 'number' && typeof role.position === 'number' && role.position >= botHighest) {
      result.skippedRoles.push({ key: role.name ?? role.id, reason: 'hiyerarsi_yetersiz' });
      continue;
    }
    try {
      await role.delete(REASON_RESET);
      result.deletedRoles += 1;
    } catch (err) {
      result.errors.push({ step: 'roller', key: role.id, error: errorText(err) });
    }
  }

  // 3) Esleme kayitlari + durum
  report(2);
  try {
    await store.deleteAllMaps(guild.id);
  } catch (err) {
    result.errors.push({ step: 'kayitlar', key: 'map', error: errorText(err) });
  }
  try {
    await store.markSetupDone(guild.id, false);
  } catch (err) {
    result.errors.push({ step: 'kayitlar', key: 'setup_done', error: errorText(err) });
  }
  await store.invalidateGuild(guild.id);

  report(total);
  return result;
}
