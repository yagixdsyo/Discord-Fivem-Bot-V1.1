/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { listDisabledCommands, listMaintenanceEntries } from '../lib/state.js';
import { getGlobalGateState } from '../../core/ownerGate.js';
import { panel } from '../../ui/templates/index.js';

function scopeLabel(t, guildId) {
  if (!guildId || guildId === 'global') return t('owner.scope_global');
  return `${t('owner.scope_guild')} \`${guildId}\``;
}

function untilText(t, until) {
  return until ? t('owner.until_inline', { bitis: `<t:${Math.floor(Number(until) / 1000)}:R>` }) : '';
}

export default {
  name: 'komut-durum',
  description: 'Kapatılmış ve bakımda olan komut/modülleri gösterir.',
  category: 'Sistem',

  async run(ctx) {
    const t = ctx.t;
    const [entries, disabled, gate] = await Promise.all([
      listMaintenanceEntries(),
      listDisabledCommands(),
      getGlobalGateState(),
    ]);

    const sections = [];

    // Global durum
    sections.push(`**${t('owner.cmd_status.global')}:**`);
    const globalLines = [];
    if (gate.pause) globalLines.push(t('owner.cmd_status.pause', { sebep: gate.pause.reason ?? '-' }));
    if (gate.maintenance) globalLines.push(t('owner.cmd_status.maintenance', { bitis: untilText(t, gate.maintenance.until) || '-' }));
    sections.push(globalLines.length > 0 ? globalLines.join('\n') : t('owner.no_data'));

    // Bakimda komutlar
    sections.push({ separator: true });
    sections.push(`**${t('owner.cmd_status.commands')}:**`);
    sections.push(
      entries.commands.length > 0
        ? entries.commands
            .map((d) => `\`${d.target}\` — ${scopeLabel(t, d.guild_id)}${untilText(t, d.until)}${d.reason ? ` — ${d.reason}` : ''}`)
            .join('\n')
        : t('owner.no_data'),
    );

    // Bakimda moduller
    sections.push({ separator: true });
    sections.push(`**${t('owner.cmd_status.modules')}:**`);
    sections.push(
      entries.modules.length > 0
        ? entries.modules
            .map((d) => `\`${d.target}\` — ${scopeLabel(t, d.guild_id)}${untilText(t, d.until)}${d.reason ? ` — ${d.reason}` : ''}`)
            .join('\n')
        : t('owner.no_data'),
    );

    // Kapali komutlar
    sections.push({ separator: true });
    sections.push(`**${t('owner.cmd_status.disabled')}:**`);
    sections.push(
      disabled.length > 0
        ? disabled
            .map((d) => `\`${d.command}\` — ${scopeLabel(t, d.guild_id)}${d.reason ? ` — ${d.reason}` : ''}`)
            .join('\n')
        : t('owner.no_data'),
    );

    await ctx.reply(panel({ emojiKey: 'SAAT', title: t('owner.cmd_status.title'), sections }));
  },
};
