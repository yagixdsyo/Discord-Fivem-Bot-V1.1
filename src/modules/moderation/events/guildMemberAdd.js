/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { emitLog } from '../../logging/lib/emit.js';
import { moderationActive } from '../lib/gate.js';
import { findActiveByUser } from '../lib/store.js';
import { applyAutorole, getWelcomeConfig, sendWelcome } from '../lib/welcome.js';

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    const guild = member?.guild;
    if (!guild) return;
    if (!(await moderationActive(guild.id))) return;

    // 1) Ban kacagi kontrolu
    try {
      const activeBans = (await findActiveByUser(guild.id, member.id)).filter((doc) => doc.type === 'ban');
      if (activeBans.length > 0) {
        await guild.bans
          .create(member.id, { reason: 'Ban kaçağı: aktif yasak varken yeniden katıldı' })
          .catch(() => {});
        await emitLog(guild, 'log_ban', {
          target: member.id,
          targetTag: member.user?.username ?? null,
          lines: ['**Ban kaçağı** yakalandı — otomatik yeniden banlandı.'],
          ids: [['Ceza', activeBans[0].case_id]],
        }).catch(() => {});
        return;
      }
    } catch {
      /* kacak kontrolu kritik degil */
    }

    // 2) Oto-rol + hos geldin
    const config = await getWelcomeConfig(guild.id);
    if (config.autoroleId) await applyAutorole(member, config.autoroleId).catch(() => {});
    if (!member.user?.bot) await sendWelcome(member, config).catch(() => {});
  },
};
