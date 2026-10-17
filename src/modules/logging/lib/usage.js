/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { emitLog } from './emit.js';

export async function logCommandUsage(ctx, command) {
  try {
    if (!ctx?.guild || !command?.name) return;
    const source = ctx.source === 'prefix' ? 'prefix' : 'slash';
    await emitLog(ctx.guild, 'log_komut_kullanim', {
      actor: ctx.user?.id ?? null,
      actorTag: ctx.user?.username ?? null,
      lines: [
        `Komut: **${source === 'prefix' ? '.' : '/'}${command.name}**`,
        ctx.channel ? `Kanal: <#${ctx.channel.id}>` : null,
      ].filter(Boolean),
      ids: command.module ? [['Modül', command.module]] : [],
    });
  } catch {
    /* yut */
  }
}
