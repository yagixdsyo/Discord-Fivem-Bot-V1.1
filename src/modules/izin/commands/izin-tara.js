/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { success, list as listTemplate } from '../../../ui/templates/index.js';
import { scanChannels, scanRoles } from '../lib/permissions.js';

export default {
  name: 'izin-tara',
  aliases: ['izintara'],
  description: 'Rol ve kanal izinlerinde tehlikeli kombinasyonlari tarar.',
  category: 'Izin Dedektifi',
  system: 'izin',
  cooldown: 10,
  permission: { discord: ['Administrator'] },
  args: [{ name: 'kapsam', type: 'string', required: false, description: 'roller|kanallar|tumu' }],
  async run(ctx) {
    const t = ctx.t;
    const kapsam = String(ctx.args.kapsam || 'tumu').toLowerCase();
    const roleRows = kapsam !== 'kanallar' ? scanRoles(ctx.guild) : [];
    const channelRows = kapsam !== 'roller' ? scanChannels(ctx.guild) : [];

    if (roleRows.length === 0 && channelRows.length === 0) {
      await ctx.reply(success(t('izin.scan_ok_title'), [t('izin.scan_ok')]));
      return;
    }

    const lines = [t('izin.scan_counts', { roller: roleRows.length, kanallar: channelRows.length })];

    if (roleRows.length > 0) {
      lines.push(t('izin.scan_roles_header'));
      for (const row of roleRows.slice(0, 5)) {
        lines.push(t('izin.scan_role_line', {
          rol: `<@&${row.role.id}>`,
          puan: row.score,
          izinler: row.findings.map((finding) => finding.flag).join(', '),
          uye: row.memberCount,
        }));
      }
    }

    if (channelRows.length > 0) {
      lines.push(t('izin.scan_channels_header'));
      for (const row of channelRows.slice(0, 5)) {
        lines.push(t('izin.scan_channel_line', {
          kanal: `<#${row.channel.id}>`,
          puan: row.score,
          bulgu: row.findings.map((finding) => finding.text).join(' | '),
        }));
      }
    }

    await ctx.reply(listTemplate({ title: t('izin.scan_title'), lines, footer: t('izin.scan_footer') }));
  },
};
