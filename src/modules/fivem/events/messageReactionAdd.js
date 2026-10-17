/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getLogger } from '../../../core/logger.js';
import { markSanctioned } from '../../guard/lib/sanction.js';
import { getRoleId } from '../lib/maps.js';
import { canReact, emojiKeyOf, findReactionRole } from '../lib/reactions.js';

export async function resolveReactionTarget(reaction) {
  if (reaction.partial) {
    const fetched = await reaction.fetch().catch(() => null);
    if (!fetched) return null;
  }
  const message = reaction.message?.partial ? await reaction.message.fetch().catch(() => null) : reaction.message;
  if (!message?.guild) return null;
  return message;
}

export default {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    try {
      if (!user || user.bot) return;
      const message = await resolveReactionTarget(reaction);
      if (!message) return;
      const guild = message.guild;

      const mapping = await findReactionRole(guild.id, message.id, emojiKeyOf(reaction.emoji)).catch(() => null);
      if (!mapping) return;
      if (!canReact(guild.id, user.id)) return;

      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member || member.user.bot) return;

      const roleId = mapping.mode === 'whitelist' ? await getRoleId(guild.id, 'whitelist') : mapping.role_id;
      if (!roleId) return;

      const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
      const me = guild.members.me;
      if (!role || !me || me.roles.highest.position <= role.position || role.managed) return;
      if (member.roles.cache.has(roleId)) return;

      await markSanctioned({ guildId: guild.id, targetId: member.id, roleIds: [roleId] }).catch(() => {});
      await member.roles.add(roleId, `Tepki rolu: ${mapping.emoji_key}`).catch(() => {});
    } catch (err) {
      getLogger().debug({ err: err?.message }, 'tepki rol ekleme hatasi');
    }
  },
};
