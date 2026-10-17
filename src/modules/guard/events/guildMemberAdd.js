/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from '../lib/auditQueue.js';
import { getGuardConfig } from '../lib/config.js';
import { guardGate, handleViolation, judgeActor, recordAndLog } from '../lib/pipeline.js';
import { hitLimit } from '../lib/rate.js';
import { enforceRaidJoin, isRaidActive, setRaidActive } from '../lib/raid.js';
import { sendOwnerLog } from '../../../owner/lib/ownerLog.js';
import { warn as warnTemplate } from '../../../ui/templates/index.js';

export default {
  name: 'guildMemberAdd',
  async execute(member, meta) {
    const guild = member?.guild;
    if (!guild) return;

    const { ok } = await guardGate(guild, meta?.client);
    if (!ok) return;

    const config = await getGuardConfig(guild.id);

    // 1) Bot ekleme korumasi
    if (member.user?.bot) {
      if (!config.modules.bot.enabled) return;

      const actorResult = await judgeActor({
        guild,
        client: meta?.client,
        config: meta?.config,
        moduleKey: 'bot',
        auditType: AuditLogEvent.BotAdd,
        targetId: member.id,
        force: true,
      });

      await handleViolation({
        guild,
        client: meta?.client,
        config,
        moduleKey: 'bot',
        type: 'bot_add',
        description: `Sunucuya bot eklendi: **${member.user.username}**`,
        target: `<@${member.id}>`,
        actorResult,
        restoreFn: async () => {
          try {
            await member.kick('Guard: yetkisiz bot ekleme');
            return { ok: true, target: member.user.username };
          } catch (err) {
            return { ok: false, error: err?.message ?? 'atilamadi' };
          }
        },
      });
      return;
    }

    // 2) Raid / giris korumasi
    const raidCfg = config.modules.davet_giris;
    if (!raidCfg.enabled) return;

    if (await isRaidActive(guild.id)) {
      const mode = raidCfg.punish === 'uyar' ? 'mute' : 'kick';
      const applied = await enforceRaidJoin(member, { mode });
      await recordAndLog({
        guild,
        moduleKey: 'davet_giris',
        type: 'raid_join',
        actorId: member.id,
        actorTag: member.user?.username ?? null,
        target: `<@${member.id}>`,
        description: 'Raid modu aktifken katılım',
        action: applied ? 'raid_katilim' : 'cozulemedi',
        extraLines: [mode === 'mute' ? '10 dakika timeout uygulandı.' : 'Üye atıldı (kick).'],
      });
      return;
    }

    const rate = await hitLimit({
      guildId: guild.id,
      module: 'davet_giris',
      actorId: 'guild',
      limit: raidCfg.limit,
      windowSec: raidCfg.window,
    });

    if (!rate.exceeded) return;

    // Raid modu ac
    await setRaidActive(guild.id, true, { minutes: 10 });
    await enforceRaidJoin(member, { mode: 'kick' });
    await recordAndLog({
      guild,
      moduleKey: 'davet_giris',
      type: 'raid_detect',
      actorId: null,
      target: null,
      description: `Katılım patlaması: **${rate.count}/${rate.limit}** (${raidCfg.window} sn)`,
      action: 'raid_ac',
      extraLines: ['Raid modu **10 dakika** açıldı; yeni katılımlar engellenecek.'],
    });

    if (meta?.config) {
      await sendOwnerLog(
        warnTemplate('Raid modu açıldı', [
          `Sunucu: **${guild.name}** (\`${guild.id}\`)`,
          `Pencere: ${rate.count}/${rate.limit} katılım (${raidCfg.window} sn)`,
          'Yeni katılımlar 10 dakika boyunca engellenecek. Kapatmak için `/raid-modu kapat`.',
        ]),
        meta.config,
      ).catch(() => {});
    }
  },
};
