/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getGlobalGateState } from '../../../core/ownerGate.js';
import { isSystemActive } from '../../../core/systemRegistry.js';
import { emitLog } from '../../logging/lib/emit.js';
import { resolveAuditActor } from './auditQueue.js';
import { isSafeActor, moduleDef } from './config.js';
import { recordIncident } from './incidents.js';
import { punishActor } from './punish.js';
import { hitLimit } from './rate.js';

const ACTION_LABELS = Object.freeze({
  ban: 'Ban',
  kick: 'Kick',
  'rolleri-al': 'Rolleri Al',
  'sadece-geri-al': 'Sadece Geri Al',
  uyar: 'Uyarı',
  'yetki-al': 'Yetki Alma',
  sil: 'Mesaj Silme',
  sustur: 'Susturma (timeout)',
  raid_ac: 'Raid Modu Açıldı',
  raid_kapat: 'Raid Modu Kapatıldı',
  raid_katilim: 'Raid Katılımı Engellendi',
  loglandi: 'Loglandı (güvenli)',
  muaf: 'Muaf (sunucu sahibi)',
  esik_alti: 'Eşik Altı',
  cozulemedi: 'İşlem Yapan Bulunamadı',
  tek_ceza: 'Tek Ceza (kilit)',
  atlandi: 'Atlandı',
});

/**
 * Guard bu sunucuda calisabilir mi?
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function guardGate(guild, client) {
  if (!guild?.id) return { ok: false, reason: 'sunucu_yok' };
  try {
    if (!(await isSystemActive({ guildId: guild.id, systemId: 'guard' }))) {
      return { ok: false, reason: 'sistem_kapali' };
    }
  } catch {
    return { ok: false, reason: 'sistem_kontrol_hatasi' };
  }
  try {
    const global = await getGlobalGateState();
    if (global?.pause?.payload?.guard === true) return { ok: false, reason: 'duraklatma' };
  } catch {
    /* duraklatma kontrolu basarisizsa guard calismaya devam eder */
  }
  return { ok: true };
}

/**
 * Olayi yapani cozer ve hakkindda karar uretir.
 * @returns {Promise<
 *   {unresolved: true} |
 *   {self: true} |
 *   {actorId: string, actorTag: string|null, reason: string|null, safe: boolean, tier: number|null, owner: boolean}
 * >}
 */
export async function judgeActor({ guild, client, config, moduleKey, auditType, targetId = null, channelId = null, force = true, resolvedActor }) {
  const resolved = resolvedActor !== undefined
    ? resolvedActor
    : await resolveAuditActor(guild, auditType, targetId, { channelId, force });
  const actorId = resolved?.actorId ?? null;
  if (!actorId) return { unresolved: true };
  if (client?.user && actorId === client.user.id) return { self: true };

  const safeInfo = await isSafeActor({
    guildId: guild.id,
    actorId,
    moduleKey,
    guildOwnerId: guild.ownerId,
    clientUserId: client?.user?.id ?? null,
    botOwnerIds: config?.ownerIds ?? [],
  });

  return {
    actorId,
    actorTag: resolved.actorTag ?? null,
    reason: resolved.reason ?? null,
    safe: safeInfo.safe,
    tier: safeInfo.tier,
    owner: actorId === guild.ownerId,
  };
}

/**
 * Olay kaydi + guard log kanali girdisi (tek yerden).
 * @returns {Promise<object>} guard_incidents dokumani
 */
export async function recordAndLog({
  guild,
  moduleKey,
  type,
  actorId = null,
  actorTag = null,
  target = null,
  description = null,
  action = null,
  safe = false,
  restored = false,
  dryRun = false,
  responseMs = null,
  payload = null,
  extraLines = [],
}) {
  const incident = await recordIncident({
    guildId: guild.id,
    moduleKey,
    type,
    actorId,
    actorTag,
    target,
    action,
    safe,
    restored,
    dryRun,
    responseMs,
    payload,
    description,
  });

  const def = moduleDef(moduleKey);
  const lines = [];
  if (description) lines.push(description);
  lines.push(
    actorId
      ? `İşlemi yapan: <@${actorId}> (\`${actorId}\`)`
      : 'İşlemi yapan: *denetim kaydında bulunamadı*',
  );
  if (action) lines.push(`Aksiyon: **${ACTION_LABELS[action] ?? action}**`);
  if (Number.isFinite(responseMs)) lines.push(`Yanıt süresi: **${Math.round(responseMs)} ms**`);
  if (restored) lines.push('Değişiklik **geri alındı**.');
  for (const line of extraLines) if (line) lines.push(line);

  await emitLog(guild, def?.logKey ?? 'log_guard', {
    target,
    lines,
    ids: [['Olay', incident.incident_id]],
    accent: safe ? 'warn' : 'error',
  });

  return incident;
}

/**
 * Ihlal akisi: esik -> ceza -> geri alma -> kayit/log.
 *
 * @param {object} opts
 * @param {import('discord.js').Guild} opts.guild
 * @param {import('discord.js').Client} opts.client
 * @param {object} opts.config guard ayarlari (getGuardConfig)
 * @param {string} opts.moduleKey
 * @param {string} opts.type olay tipi (ör. 'channel_delete')
 * @param {string|null} [opts.description]
 * @param {object} opts.actorResult judgeActor ciktisi
 * @param {string|null} [opts.target]
 * @param {Function|null} [opts.restoreFn] ({actorId, punish}) => {ok, target, newId, ...}
 * @param {boolean} [opts.dryRun]
 * @param {boolean} [opts.threshold] esik uygulanacak mi (varsayilan true)
 */
export async function handleViolation({
  guild,
  client,
  config,
  moduleKey,
  type,
  description = null,
  actorResult,
  target = null,
  restoreFn = null,
  dryRun = false,
  threshold = true,
}) {
  const cfg = config?.modules?.[moduleKey] ?? null;
  if (!cfg || cfg.enabled === false) return { skipped: true, reason: 'modul_kapali' };
  if (!actorResult || actorResult.self) return { skipped: true, reason: 'bot' };

  const started = Date.now();

  if (actorResult.unresolved) {
    const incident = await recordAndLog({
      guild,
      moduleKey,
      type,
      target,
      description,
      action: 'cozulemedi',
      extraLines: ['Değişiklik geri alınmadı (yanlış müdahaleyi önlemek için aktör şart).'],
    });
    return { incident, unresolved: true };
  }

  if (actorResult.owner) {
    const incident = await recordAndLog({
      guild,
      moduleKey,
      type,
      actorId: actorResult.actorId,
      actorTag: actorResult.actorTag,
      target,
      description,
      action: 'muaf',
      safe: true,
      extraLines: ['Sunucu sahibi işlemi — Guard muaftır (loglandı).'],
    });
    return { incident, safe: true, owner: true };
  }

  if (actorResult.safe) {
    const incident = await recordAndLog({
      guild,
      moduleKey,
      type,
      actorId: actorResult.actorId,
      actorTag: actorResult.actorTag,
      target,
      description,
      action: 'loglandi',
      safe: true,
      extraLines: [`Güvenli liste (kademe ${actorResult.tier ?? '-'}) — işlem engellenmedi, loglandı.`],
    });
    return { incident, safe: true };
  }

  let rate = null;
  if (threshold) {
    rate = await hitLimit({
      guildId: guild.id,
      module: moduleKey,
      actorId: actorResult.actorId,
      limit: cfg.limit,
      windowSec: cfg.window,
    });
    if (!rate.exceeded) {
      const incident = await recordAndLog({
        guild,
        moduleKey,
        type,
        actorId: actorResult.actorId,
        actorTag: actorResult.actorTag,
        target,
        description,
        action: 'esik_alti',
        extraLines: [`Eşik altı: **${rate.count}/${rate.limit}** (${cfg.window} sn) — ceza uygulanmadı.`],
      });
      return { incident, belowThreshold: true, count: rate.count };
    }
  }

  // 1) CEZA
  const punish = await punishActor(guild, {
    actorId: actorResult.actorId,
    moduleKey,
    punishType: cfg.punish,
    reasonText: description,
    dryRun,
    client,
  });

  // 2) GERI ALMA
  let restore = null;
  if (typeof restoreFn === 'function') {
    try {
      restore = await restoreFn({ actorId: actorResult.actorId, punish });
    } catch (err) {
      restore = { ok: false, error: err?.message ?? 'geri_alma_hatasi' };
    }
  }

  // 3) KAYIT + LOG (cezayi geciktirmez)
  const responseMs = Date.now() - started;
  const extraLines = [];
  if (rate) extraLines.push(`Eşik: **${rate.count}/${rate.limit}** (${cfg.window} sn)`);
  if (punish?.skipped) {
    extraLines.push(
      punish.lockHeld === false
        ? 'Aynı kişi için ceza kilidi açıktı — yalnızca geri alma uygulandı.'
        : 'Ceza uygulanamadı (üye yok/izin).',
    );
  }
  if (punish?.ownerProtected) extraLines.push('Sunucu sahibi: yalnızca tehlikeli yetkileri alındı.');
  if (restore && restore.ok === false) {
    extraLines.push(`Geri alma başarısız: ${restore.error ?? 'bilinmeyen hata'}`);
  } else if (restore?.target) {
    extraLines.push(`Geri alınan hedef: ${restore.target}${restore.newId ? ` (yeni ID: \`${restore.newId}\`)` : ''}`);
  }

  const incident = await recordAndLog({
    guild,
    moduleKey,
    type,
    actorId: actorResult.actorId,
    actorTag: actorResult.actorTag,
    target,
    description,
    action: punish?.skipped ? (punish.lockHeld === false ? 'tek_ceza' : 'atlandi') : punish?.action ?? null,
    restored: Boolean(restore?.ok),
    responseMs,
    dryRun,
    payload: {
      count: rate?.count ?? null,
      punish: punish
        ? {
            action: punish.action,
            skipped: Boolean(punish.skipped),
            ownerProtected: Boolean(punish.ownerProtected),
            removedRoles: punish.removedRoles ?? [],
          }
        : null,
      restore: restore ?? null,
    },
    extraLines,
  });

  // Saldiri oncesi snapshot: ceza uygulandiysa arka planda tetikle
  if (!dryRun && punish && !punish.skipped) {
    import('../../backup/lib/auto.js')
      .then((module) => module.triggerPreSnapshot(guild))
      .catch(() => {});
  }

  return { incident, punish, restore, responseMs };
}

export { ACTION_LABELS };
