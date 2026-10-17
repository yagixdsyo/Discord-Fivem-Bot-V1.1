/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../db/index.js';
import { panel } from '../../ui/templates/index.js';
import { footerLine } from '../../ui/v2.js';
import { sendOwnerLog } from './ownerLog.js';

/**
 * Denetim kaydini DB'ye yazar (log gonderimi yapmaz).
 * @returns {Promise<object>} yazilan kayit
 */
export async function writeAuditRecord({ ownerId, action, target = null, guildId = null, payload = null }) {
  const doc = {
    owner_id: ownerId,
    action,
    target,
    guild_id: guildId,
    payload: payload ?? null,
    at: new Date().toISOString(),
  };
  if (isDbReady()) {
    try {
      await getCollection('owner_audit').insertOne({ ...doc });
    } catch {
      /* denetim yazilamazsa islem durdurulmaz */
    }
  }
  return doc;
}

/**
 * Denetim kaydi + owner log kanalina denetim karti.
 * @param {{
 *   config: object,
 *   ownerId: string,
 *   action: string,
 *   target?: string|null,
 *   guildId?: string|null,
 *   payload?: object|null,
 *   t?: ((key: string, vars?: object) => string)|null,
 *   detailLines?: string[],
 * }} opts
 */
export async function auditAction({ config, ownerId, action, target = null, guildId = null, payload = null, t = null, detailLines = [] }) {
  const doc = await writeAuditRecord({ ownerId, action, target, guildId, payload });

  if (t) {
    const lines = [
      `**${t('owner.label_owner_actor')}:** ${ownerId === 'system' ? t('owner.system_actor') : `<@${ownerId}>`}`,
      target ? `**${t('owner.label_target')}:** ${target}` : null,
      `**${t('owner.label_time')}:** <t:${Math.floor(Date.now() / 1000)}:f>`,
      ...detailLines,
    ].filter(Boolean);

    if (payload) {
      lines.push('```json\n' + JSON.stringify(payload).slice(0, 700) + '\n```');
    }

    const card = panel({
      emojiKey: 'BELGE',
      title: t('owner.audit_title'),
      subtitle: action,
      sections: lines,
      footer: footerLine([t('common.audit_id', { id: doc.at })]),
    });
    await sendOwnerLog(card, config);
  }

  return doc;
}
