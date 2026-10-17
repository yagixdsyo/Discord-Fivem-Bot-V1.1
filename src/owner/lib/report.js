/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../db/index.js';
import { getBlacklistEntry, getGuildGateState } from '../../core/ownerGate.js';
import { getGuildModuleList } from '../../core/moduleRegistry.js';
import { panel } from '../../ui/templates/index.js';
import { footerLine } from '../../ui/v2.js';

export async function collectGuildDetail(guild) {
  const [dbDoc, gate, blacklist, modules, errors, guardCount] = await Promise.all([
    isDbReady()
      ? getCollection('guilds').findOne({ guild_id: guild.id }).catch(() => null)
      : Promise.resolve(null),
    getGuildGateState(guild.id),
    getBlacklistEntry(guild.id),
    getGuildModuleList(guild.id).catch(() => []),
    isDbReady()
      ? getCollection('bot_errors')
          .find({ 'context.guildId': guild.id })
          .sort({ at: -1 })
          .limit(5)
          .toArray()
          .catch(() => [])
      : Promise.resolve([]),
    isDbReady()
      ? getCollection('guard_incidents').countDocuments({ guild_id: guild.id }).catch(() => 0)
      : Promise.resolve(0),
  ]);

  const ownerMember = await guild.fetchOwner().catch(() => null);

  return { dbDoc, gate, blacklist, modules, errors, guardCount, ownerMember };
}

/**
 * @returns {object} V2 payload
 */
export async function buildGuildDetailCard({ guild, t }) {
  const { dbDoc, gate, blacklist, modules, errors, guardCount, ownerMember } = await collectGuildDetail(guild);

  const infoLines = [
    `**${t('owner.label_id')}:** \`${guild.id}\``,
    `**${t('owner.label_owner')}:** ${ownerMember ? `${ownerMember.user.tag} (\`${ownerMember.id}\`)` : '-'}`,
    `**${t('owner.label_members')}:** ${guild.memberCount ?? '-'}`,
    `**${t('owner.label_joined')}:** <t:${Math.floor((guild.joinedTimestamp ?? Date.now()) / 1000)}:R>`,
    `**${t('owner.label_setup')}:** ${dbDoc?.setup_done ? t('owner.yes') : t('owner.no')}`,
    `**${t('owner.label_bot_type')}:** ${dbDoc?.bot_type ?? '-'}`,
  ];

  const openModules = modules.filter((m) => m.enabled && !m.coreModule).map((m) => m.name);
  const closedModules = modules.filter((m) => !m.enabled).map((m) => m.name);
  const moduleLines = [
    `**${t('owner.label_modules_open')}:** ${openModules.length > 0 ? openModules.join(', ') : '-'}`,
    `**${t('owner.label_modules_closed')}:** ${closedModules.length > 0 ? closedModules.join(', ') : '-'}`,
  ];

  const gateLines = [
    `**${t('owner.label_deactivated')}:** ${gate.deactivated ? (gate.deactivated.reason ?? t('owner.yes')) : t('owner.no')}`,
    `**${t('owner.label_blacklist')}:** ${blacklist ? (blacklist.reason ?? t('owner.yes')) : t('owner.no')}`,
    `**${t('owner.label_disabled_commands')}:** ${gate.disabledCommands.length > 0 ? '`' + gate.disabledCommands.join('`, `') + '`' : '-'}`,
  ];

  const maintenanceCount = Object.keys(gate.commandMaintenance ?? {}).length + Object.keys(gate.moduleMaintenance ?? {}).length;
  gateLines.push(`**${t('owner.label_maintenance_count')}:** ${maintenanceCount}`);

  const errorLines = errors.length > 0
    ? errors.map((e) => `\`${e.code}\` — ${String(e.message ?? '').slice(0, 80)}`)
    : [t('owner.no_data')];

  const sections = [
    ...infoLines,
    { separator: true },
    ...moduleLines,
    { separator: true },
    ...gateLines,
    { separator: true },
    `**${t('owner.label_guard_incidents')}:** ${guardCount}`,
    `**${t('owner.label_recent_errors')}:**`,
    ...errorLines,
  ];

  return panel({
    emojiKey: 'ARAMA',
    title: guild.name,
    subtitle: t('owner.detail_title'),
    sections,
    footer: footerLine([`ID: ${guild.id}`]),
  });
}
