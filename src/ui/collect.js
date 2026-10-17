/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { reportError } from '../core/errorHandler.js';

/**
 * @param {import('discord.js').Message} message collector baglanacak bot mesaji
 * @param {{
 *   filter?: (i: import('discord.js').Interaction) => boolean,
 *   onCollect: (i: import('discord.js').MessageComponentInteraction, collector: import('discord.js').MessageComponentCollector) => unknown,
 *   onEnd?: (collected: unknown, reason: string) => unknown,
 *   timeMs?: number,
 * }} opts
 * @returns {import('discord.js').MessageComponentCollector}
 */
export function collect(message, { filter, onCollect, onEnd, timeMs = 120_000 }) {
  const collector = message.createMessageComponentCollector({
    time: timeMs,
    ...(filter ? { filter } : {}),
  });

  collector.on('collect', (interaction) => {
    Promise.resolve()
      .then(() => onCollect(interaction, collector))
      .catch((err) =>
        reportError(err, {
          source: 'collector',
          guildId: interaction.guildId ?? null,
          userId: interaction.user?.id ?? null,
        }),
      );
  });

  if (onEnd) {
    collector.on('end', (collected, reason) => {
      Promise.resolve()
        .then(() => onEnd(collected, reason))
        .catch(() => {});
    });
  }

  return collector;
}

/** Sahte (olmayan) kullanici tiklamalarina nazik cevap icin filtre uretir. */
export function ownerFilter(ownerId) {
  return (i) => i.user.id === ownerId;
}
