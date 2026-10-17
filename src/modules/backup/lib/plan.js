/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export const CATEGORY_TYPE = 4; // ChannelType.GuildCategory

/** Sunucudan saf gorunum (test edilebilir; fake guild ile de calisir). */
export function snapshotGuildView(guild) {
  const roles = [];
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id) continue;
    roles.push({
      id: role.id,
      name: role.name,
      color: role.color ?? 0,
      hoist: Boolean(role.hoist),
      mentionable: Boolean(role.mentionable),
      permissions: String(role.permissions?.bitfield ?? 0n),
      managed: Boolean(role.managed),
      createdAt: role.createdTimestamp ?? null,
    });
  }

  const channels = [];
  for (const channel of guild.channels.cache.values()) {
    channels.push({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId ?? null,
      createdAt: channel.createdTimestamp ?? null,
    });
  }

  return {
    roles,
    channels,
    guild: {
      name: guild.name ?? null,
      verificationLevel: guild.verificationLevel ?? null,
      afkChannelId: guild.afkChannelId ?? null,
      afkTimeout: guild.afkTimeout ?? null,
      systemChannelId: guild.systemChannelId ?? null,
      rulesChannelId: guild.rulesChannelId ?? null,
      preferredLocale: guild.preferredLocale ?? null,
    },
  };
}

const GUILD_SETTING_KEYS = [
  'name',
  'verificationLevel',
  'afkChannelId',
  'afkTimeout',
  'systemChannelId',
  'rulesChannelId',
  'preferredLocale',
];

/**
 * Backup kurulum plani.
 *
 * @param {object} data backup verisi (collectGuildData ciktisi)
 * @param {object} view snapshotGuildView ciktisi
 * @param {{temizle?: boolean, backupAtMs?: number|null, keepChannelIds?: string[], keepRoleIds?: string[]}} [opts]
 */
export function planInstall(data, view, { temizle = false, backupAtMs = null, keepChannelIds = [], keepRoleIds = [] } = {}) {
  const keepChannels = new Set(keepChannelIds);
  const keepRoles = new Set(keepRoleIds);

  const backupRoles = (data.roles ?? []).filter((role) => !role.managed);
  const backupCategories = (data.channels ?? []).filter((channel) => channel.type === CATEGORY_TYPE);
  const backupChannels = (data.channels ?? []).filter((channel) => channel.type !== CATEGORY_TYPE);

  const backupRoleNames = new Set(backupRoles.map((role) => role.name));
  const backupCategoryNames = new Set(backupCategories.map((channel) => channel.name));
  const backupChannelKeys = new Set(backupChannels.map((channel) => `${channel.type}:${channel.name}`));

  const createRoles = [];
  const updateRoles = [];
  for (const roleData of backupRoles) {
    const existing = view.roles.find((role) => !role.managed && role.name === roleData.name);
    if (!existing) {
      createRoles.push(roleData);
      continue;
    }
    const changes = {};
    if ((existing.color ?? 0) !== (roleData.color ?? 0)) changes.color = roleData.color ?? 0;
    if (Boolean(existing.hoist) !== Boolean(roleData.hoist)) changes.hoist = Boolean(roleData.hoist);
    if (Boolean(existing.mentionable) !== Boolean(roleData.mentionable)) changes.mentionable = Boolean(roleData.mentionable);
    if (String(existing.permissions ?? '0') !== String(roleData.permissions ?? '0')) changes.permissions = roleData.permissions;
    if (Object.keys(changes).length > 0) updateRoles.push({ existingId: existing.id, name: roleData.name, changes });
  }

  const createCategories = backupCategories.filter(
    (channel) => !view.channels.some((existing) => existing.type === CATEGORY_TYPE && existing.name === channel.name),
  );
  const createChannels = backupChannels.filter(
    (channel) => !view.channels.some((existing) => existing.type === channel.type && existing.name === channel.name),
  );

  const deleteChannels = [];
  const deleteRoles = [];
  if (temizle && backupAtMs) {
    for (const channel of view.channels) {
      if (keepChannels.has(channel.id)) continue;
      if (channel.createdAt && channel.createdAt <= backupAtMs) continue; // backup oncesi: dokunma
      if (channel.type === CATEGORY_TYPE ? backupCategoryNames.has(channel.name) : backupChannelKeys.has(`${channel.type}:${channel.name}`)) continue;
      deleteChannels.push({ id: channel.id, name: channel.name });
    }
    for (const role of view.roles) {
      if (role.managed || keepRoles.has(role.id)) continue;
      if (role.createdAt && role.createdAt <= backupAtMs) continue;
      if (backupRoleNames.has(role.name)) continue;
      deleteRoles.push({ id: role.id, name: role.name });
    }
  }

  const settings = [];
  const target = data.guild ?? {};
  for (const key of GUILD_SETTING_KEYS) {
    const from = view.guild?.[key] ?? null;
    const to = target[key] ?? null;
    if (String(from ?? '') !== String(to ?? '')) settings.push({ key, from, to });
  }

  // Uyarilar: parent kategorisi ne sunucuda ne planda varsa
  const warnings = [];
  const plannedCategoryNames = new Set([...backupCategories.map((c) => c.name)]);
  for (const channel of createChannels) {
    if (!channel.parentId) continue;
    const parent = (data.channels ?? []).find((c) => c.id === channel.parentId);
    if (!parent) continue;
    const parentExists = view.channels.some((existing) => existing.type === CATEGORY_TYPE && existing.name === parent.name);
    if (!parentExists && !plannedCategoryNames.has(parent.name)) {
      warnings.push(`#${channel.name}: üst kategori (${parent.name}) bulunamadı, kategorisiz kurulacak`);
    }
  }

  return {
    createRoles,
    updateRoles,
    createCategories,
    createChannels,
    deleteChannels,
    deleteRoles,
    settings,
    memberRoles: data.memberRoles ?? null,
    warnings,
    counts: {
      createRoles: createRoles.length,
      updateRoles: updateRoles.length,
      createCategories: createCategories.length,
      createChannels: createChannels.length,
      deleteChannels: deleteChannels.length,
      deleteRoles: deleteRoles.length,
      settings: settings.length,
    },
  };
}
