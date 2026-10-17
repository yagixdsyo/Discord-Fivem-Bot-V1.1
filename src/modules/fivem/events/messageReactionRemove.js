/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getLogger } from '../../../core/logger.js';
import { getRoleId } from '../lib/maps.js';
import { canReact, emojiKeyOf, findReactionRole } from '../lib/reactions.js';
import { getSetting } from '../lib/state.js';

export default {
  name: 'messageReactionRemove',
  async execute(reaction, user) {
    try {
      if (!user || user.bot) return;

      if (reaction.partial) {
        const fetched = await reaction.fetch().catch(() => null);
        if (!fetched) return;
      }
      const message = reaction.message?.partial ? await reaction.message.fetch().catch(() => null) : reaction.message;
      if (!message?.guild) return;
      const guild = message.guild;

      const mapping = await findReactionRole(guild.id, message.id, emojiKeyOf(reaction.emoji)).catch(() => null);
      if (!mapping) return;

      const removeOnUnreact = (await getSetting(guild.id, 'fivem.tepki.removeOnUnreact').catch(() => true)) !== false;
      if (!removeOnUnreact) return;
      if (!canReact(guild.id, user.id)) return;

      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member || member.user.bot) return;

      const roleId = mapping.mode === 'whitelist' ? await getRoleId(guild.id, 'whitelist') : mapping.role_id;
      if (!roleId || !member.roles.cache.has(roleId)) return;

      await member.roles.remove(roleId, `Tepki kaldirildi: ${mapping.emoji_key}`).catch(() => {});
    } catch (err) {
      getLogger().debug({ err: err?.message }, 'tepki rol kaldirma hatasi');
    }
  },
};
