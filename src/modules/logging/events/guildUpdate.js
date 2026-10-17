/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { emitLog } from '../lib/emit.js';

export default {
  name: 'guildUpdate',
  async execute(oldGuild, newGuild) {
    if (!newGuild?.id) return;
    const lines = [];

    if (oldGuild.name !== newGuild.name) {
      lines.push(`İsim: \`${oldGuild.name}\` -> \`${newGuild.name}\``);
    }
    if (oldGuild.iconURL() !== newGuild.iconURL()) lines.push('Sunucu ikonu güncellendi');
    if (oldGuild.bannerURL() !== newGuild.bannerURL()) lines.push('Sunucu bannerı güncellendi');
    if (oldGuild.ownerId !== newGuild.ownerId) {
      lines.push(`Sahip: <@${oldGuild.ownerId}> -> <@${newGuild.ownerId}>`);
    }
    if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
      lines.push(`Doğrulama seviyesi: ${oldGuild.verificationLevel} -> ${newGuild.verificationLevel}`);
    }
    if (oldGuild.preferredLocale !== newGuild.preferredLocale) {
      lines.push(`Dil: ${oldGuild.preferredLocale} -> ${newGuild.preferredLocale}`);
    }

    if (lines.length === 0) return;
    await emitLog(newGuild, 'log_guild_update', {
      lines,
      ids: [['Sunucu', newGuild.id]],
    });
  },
};
