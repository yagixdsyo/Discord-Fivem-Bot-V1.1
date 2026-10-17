/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { confirm as confirmTemplate, success, warn } from '../../ui/templates/index.js';
import { disabledCard } from '../../ui/templates/base.js';
import { collect } from '../../ui/collect.js';

function buildConfirmCard({ t, ownerId, title, description, danger = false }) {
  return confirmTemplate({
    title: title ?? t('owner.confirm_title'),
    description,
    confirmId: `owner:onay:${ownerId}`,
    cancelId: `owner:iptal:${ownerId}`,
    danger,
    confirmLabel: t('owner.confirm_yes'),
    cancelLabel: t('owner.confirm_no'),
  });
}

/**
 * Onay mesajina collector baglar; kullanici karar verince true/false doner.
 * Onay mesaji karar sonrasi sonuc kartina cevrilir (butonsuz).
 */
function awaitDecision(message, { t, ownerId, baseCard, timeoutMs = 60_000 }) {
  return new Promise((resolve) => {
    let settled = false;

    collect(message, {
      filter: (i) => i.user.id === ownerId,
      timeMs: timeoutMs,
      onCollect: async (i) => {
        if (settled) return;
        settled = true;
        const approved = i.customId === `owner:onay:${ownerId}`;
        try {
          await i.update(approved ? success(t('owner.confirmed'), []) : warn(t('owner.cancelled'), []));
        } catch {
          /* mesaj guncellenemedi */
        }
        resolve(approved);
      },
      onEnd: async () => {
        if (settled) return;
        settled = true;
        try {
          await message.edit(disabledCard(baseCard));
        } catch {
          /* mesaj duzenlenemedi */
        }
        resolve(false);
      },
    });
  });
}

/** Prefix komut akisi icin onay. @returns {Promise<boolean>} */
export async function ownerConfirm(ctx, { title, description, danger = false, timeoutMs = 60_000 } = {}) {
  const ownerId = ctx.user.id;
  const baseCard = buildConfirmCard({ t: ctx.t, ownerId, title, description, danger });
  const message = await ctx.reply(baseCard, { fetchReply: true });
  if (!message?.createMessageComponentCollector) return false;
  return awaitDecision(message, { t: ctx.t, ownerId, baseCard, timeoutMs });
}

/** Panel buton tiklamasi icin onay (efemer). @returns {Promise<boolean>} */
export async function interactionConfirm(interaction, { t, title, description, danger = false, timeoutMs = 60_000 } = {}) {
  const ownerId = interaction.user.id;
  const baseCard = buildConfirmCard({ t, ownerId, title, description, danger });
  const message = await interaction.reply({ ...baseCard, fetchReply: true });
  if (!message?.createMessageComponentCollector) return false;
  return awaitDecision(message, { t, ownerId, baseCard, timeoutMs });
}
