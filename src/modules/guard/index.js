/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { setLogDeletePunisher } from '../logging/lib/protection.js';
import { getGuardConfig, isSafeActor } from './lib/config.js';
import { guardGate, recordAndLog } from './lib/pipeline.js';
import { punishActor } from './lib/punish.js';
import { runNightTick, startupNightCheck } from './lib/night.js';

const NIGHT_TICK_MS = 60_000;
let nightTimer = null;

export default {
  id: 'guard',
  name: 'Guard',
  description: 'Sunucu koruması: yetkisiz işlemlerde anında ceza ve geri alma.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: true,

  async setup(client, { config, logger }) {
    // Silinemez log koruması: ceza uygulayici kancasi
    setLogDeletePunisher(async ({ guildId, userId, channelId, messageId }) => {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return { ok: false, reason: 'sunucu_yok' };

      const gate = await guardGate(guild, client);
      if (!gate.ok) return { ok: false, reason: gate.reason };

      const guardConfig = await getGuardConfig(guildId);
      const cfg = guardConfig.modules.mesaj_koruma;
      if (!cfg.enabled) return { ok: false, reason: 'modul_kapali' };

      const safeInfo = await isSafeActor({
        guildId,
        actorId: userId,
        moduleKey: 'mesaj_koruma',
        guildOwnerId: guild.ownerId,
        clientUserId: client.user.id,
        botOwnerIds: config.ownerIds ?? [],
      });

      if (guild.ownerId === userId || safeInfo.safe || userId === client.user.id) {
        await recordAndLog({
          guild,
          moduleKey: 'mesaj_koruma',
          type: 'log_delete_exempt',
          actorId: userId,
          target: `<#${channelId}>`,
          description: 'Silinemez log mesajı silindi',
          action: 'loglandi',
          safe: true,
          extraLines: [`Mesaj: \`${messageId}\``],
        });
        return { ok: true, exempt: true };
      }

      const punish = await punishActor(guild, {
        actorId: userId,
        moduleKey: 'mesaj_koruma',
        punishType: cfg.punish,
        reasonText: `Silinemez log mesajı silindi (${messageId})`,
        client,
      });
      await recordAndLog({
        guild,
        moduleKey: 'mesaj_koruma',
        type: 'log_delete',
        actorId: userId,
        target: `<#${channelId}>`,
        description: 'Silinemez log mesajı silindi',
        action: punish?.skipped ? 'tek_ceza' : punish?.action ?? null,
        payload: { punish: { action: punish?.action, skipped: Boolean(punish?.skipped), removedRoles: punish?.removedRoles ?? [] } },
        extraLines: [`Mesaj: \`${messageId}\``],
      });
      return { ok: true, punished: !punish?.skipped, action: punish?.action };
    });

    // Gece modu zamanlayicisi (60 sn)
    nightTimer = setInterval(() => {
      for (const guild of client.guilds.cache.values()) {
        runNightTick(client, guild.id, config).catch(() => {});
      }
    }, NIGHT_TICK_MS);
    nightTimer.unref?.();

    // Beklenmedik kapanma sonrasi: uykuda kalan izinleri geri yukle
    startupNightCheck(client, config)
      .then((woken) => {
        if (woken > 0) logger.info({ woken }, 'Gece modu: açılışta geri yüklendi');
      })
      .catch(() => {});

    logger.info('Guard modulu hazir');
  },

  async teardown() {
    if (nightTimer) {
      clearInterval(nightTimer);
      nightTimer = null;
    }
  },
};
