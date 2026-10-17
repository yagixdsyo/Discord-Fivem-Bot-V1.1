/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

export async function getTicketConfig(guildId) {
  const { getSetting } = await import('../../fivem/lib/state.js');
  const { getRoleId } = await import('../../fivem/lib/maps.js');
  const id = (typeof guildId === 'object' && guildId !== null) ? guildId.id : guildId;
  const cfg = (await getSetting(id, 'ticket.config')) ?? {};
  const staffKeys = cfg.staffRoleKeys ?? ['yonetici', 'ust_yetkili', 'destek'];
  const staffRoles = [];
  for (const key of staffKeys) {
    const r = await getRoleId(id, key);
    if (r) staffRoles.push(r);
  }
  return {
    staffRoles,
    ticketCategoryId: cfg.ticketCategoryId ?? null,
    nameTemplate: cfg.nameTemplate ?? 'ticket-{n}',
    allowMemberClose: cfg.allowMemberClose !== false,
    memberCloseReopen: cfg.memberCloseReopen !== false,
    ...cfg,
  };
}
