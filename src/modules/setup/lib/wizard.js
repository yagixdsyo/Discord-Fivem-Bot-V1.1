/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { disabledCard } from '../../../ui/templates/base.js';
import { warn as warnTemplate } from '../../../ui/templates/index.js';
import { buildSetupPlan } from './plan.js';
import { collectPrecheck, evaluatePrecheck } from './precheck.js';
import { createDbStore } from './store.js';
import { runReset, runSetup } from './engine.js';
import { DEFAULT_PACKAGE, PACKAGES } from './catalog.js';
import { waitForInteraction, waitForModalSubmit } from './interact.js';
import {
  confirmPayload,
  precheckCard,
  progressPayload,
  resetConfirmPayload,
  resetSummaryPayload,
  summaryPayload,
  wizardPayload,
} from './view.js';

function normalizePackages(values) {
  const set = new Set((values ?? []).map((v) => String(v)));
  if (set.size === 0) set.add(DEFAULT_PACKAGE);
  return set;
}

/**
 * Slash'te otomatik defer devreye girmisse ctx.reply bir Message yerine
 * InteractionResponse donebilir; collector icin gercek mesaji cozer.
 */
async function ensureMessage(ctx, sent) {
  if (sent && typeof sent.awaitMessageComponent === 'function') return sent;
  if (ctx.interaction) {
    try {
      const fetched = await ctx.interaction.fetchReply();
      if (fetched && typeof fetched.awaitMessageComponent === 'function') return fetched;
    } catch {
      /* yut */
    }
  }
  return sent ?? null;
}

/** CFX kodu + sunucu IP modali. */
async function handleOptionsModal(interaction, message, state, t) {
  const modal = new ModalBuilder()
    .setCustomId(`setupwiz:modal:${state.ownerId}`)
    .setTitle(t('setup.options.title'));

  const cfxInput = new TextInputBuilder()
    .setCustomId('cfx')
    .setLabel(t('setup.options.cfx_label'))
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(64);
  if (state.cfxCode) cfxInput.setValue(String(state.cfxCode).slice(0, 64));

  const ipInput = new TextInputBuilder()
    .setCustomId('ip')
    .setLabel(t('setup.options.ip_label'))
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(64);
  if (state.serverIp) ipInput.setValue(String(state.serverIp).slice(0, 64));

  modal.addComponents(new ActionRowBuilder().addComponents(cfxInput), new ActionRowBuilder().addComponents(ipInput));

  await interaction.showModal(modal);

  const submitted = await waitForModalSubmit(message, {
    customId: `setupwiz:modal:${state.ownerId}`,
    ownerId: state.ownerId,
  });

  if (!submitted) return;

  const cfx = submitted.fields.getTextInputValue('cfx').trim();
  const ip = submitted.fields.getTextInputValue('ip').trim();
  state.cfxCode = cfx || null;
  state.serverIp = ip || null;
  await submitted.deferUpdate().catch(() => {});
  await message.edit(wizardPayload(t, state)).catch(() => {});
}

/**
 * Sihirbazi calistirir.
 * @param {object} ctx komut baglami
 * @param {{resetFirst?: boolean}} opts
 */
export async function runSetupWizard(ctx, { resetFirst = false } = {}) {
  const t = ctx.t;
  const guild = ctx.guild;
  const ownerId = ctx.user.id;
  const store = createDbStore();

  // On kontrol
  const evaluation = evaluatePrecheck(await collectPrecheck(guild, { store }));
  if (!evaluation.ok) {
    await ctx.reply(precheckCard(t, evaluation));
    return;
  }

  const state = {
    ownerId,
    packages: new Set([DEFAULT_PACKAGE]),
    otoRolId: null,
    yetkiliRolId: null,
    cfxCode: ctx.config?.fivem?.cfxCode ?? null,
    serverIp: null,
    precheck: evaluation,
  };

  let message = null;
  let lastPayload = null;

  const render = async (payload, { edit = true } = {}) => {
    lastPayload = payload;
    if (message && edit) await message.edit(payload);
    else message = await ensureMessage(ctx, await ctx.reply(payload, { fetchReply: true }));
    return message;
  };

  // ------------------------------------------------------------------
  // 0) Istege bagli: once sifirla
  // ------------------------------------------------------------------
  if (resetFirst) {
    await render(resetConfirmPayload(t, { ownerId }));
    if (!message) {
      await ctx.followUp(warnTemplate(t('setup.wizard.error_retry'), [t('setup.cancel.body')]));
      return;
    }
    const decision = await waitForInteraction(message, ownerId);
    if (!decision || decision.customId !== `setupwiz:sifirla-onay:${ownerId}`) {
      if (decision) await decision.update(warnTemplate(t('setup.cancel.title'), [t('setup.cancel.body')])).catch(() => {});
      else await message.edit(disabledCard(lastPayload)).catch(() => {});
      return;
    }

    await decision.update(progressPayload(t, { index: 0, total: 3, result: null })).catch(() => {});
    // TUM kanal/kategori/rol silinir; owner kanali ve komut kanali korunur.
    const keepChannelIds = [
      ctx.config?.ownerLog?.channelId,
      ctx.interaction?.channelId ?? ctx.message?.channelId,
    ].filter(Boolean);
    const resetResult = await runReset(guild, {
      store,
      keepChannelIds,
      onProgress: async ({ index, total }) => {
        await message.edit(progressPayload(t, { index, total, result: null })).catch(() => {});
      },
    });
    lastPayload = resetSummaryPayload(t, resetResult);
    await message.edit(lastPayload).catch(() => {});
  }

  // ------------------------------------------------------------------
  // 1) Sihirbaz dongusu
  // ------------------------------------------------------------------
  await render(wizardPayload(t, state), { edit: Boolean(message) });
  if (!message) {
    await ctx.followUp(warnTemplate(t('setup.wizard.error_retry'), [t('setup.cancel.body')]));
    return;
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const interaction = await waitForInteraction(message, ownerId);
    if (!interaction) {
      await message.edit(disabledCard(lastPayload ?? wizardPayload(t, state))).catch(() => {});
      return;
    }

    const parts = interaction.customId.split(':');
    const action = parts[1];

    if (action === 'paket') {
      state.packages = normalizePackages(interaction.values);
      lastPayload = wizardPayload(t, state);
      await interaction.update(lastPayload).catch(() => {});
      continue;
    }

    if (action === 'otorol') {
      state.otoRolId = interaction.values[0] ?? null;
      lastPayload = wizardPayload(t, state);
      await interaction.update(lastPayload).catch(() => {});
      continue;
    }

    if (action === 'yetkili') {
      state.yetkiliRolId = interaction.values[0] ?? null;
      lastPayload = wizardPayload(t, state);
      await interaction.update(lastPayload).catch(() => {});
      continue;
    }

    if (action === 'secenek') {
      await handleOptionsModal(interaction, message, state, t);
      continue;
    }

    if (action === 'iptal') {
      lastPayload = warnTemplate(t('setup.cancel.title'), [t('setup.cancel.body')]);
      await interaction.update(lastPayload).catch(() => {});
      return;
    }

    if (action === 'baslat') {
      const plan = buildSetupPlan({ packages: state.packages, options: state });
      lastPayload = confirmPayload(t, plan, { ownerId });
      await interaction.update(lastPayload).catch(() => {});

      const decision = await waitForInteraction(message, ownerId);
      if (!decision) {
        await message.edit(disabledCard(lastPayload)).catch(() => {});
        return;
      }

      if (decision.customId !== `setupwiz:onayla:${ownerId}`) {
        lastPayload = wizardPayload(t, state);
        await decision.update(lastPayload).catch(() => {});
        continue;
      }

      // Onaylandi: ilerleme + kurulum
      await decision.update(progressPayload(t, { index: 0, total: 5, result: null })).catch(() => {});
      const result = await runSetup(guild, {
        store,
        plan,
        onProgress: async ({ index, total, result: partial }) => {
          await message.edit(progressPayload(t, { index, total, result: partial })).catch(() => {});
        },
      });

      let channelDocs = [];
      try {
        channelDocs = await store.getMap('channels_map', guild.id);
      } catch {
        /* yut */
      }
      lastPayload = summaryPayload(t, result, { channelDocs });
      await message.edit(lastPayload).catch(() => {});
      return;
    }

    await interaction.deferUpdate().catch(() => {});
  }
}

/** Kullanilabilir paket id'leri (dokumantasyon/test icin). */
export const WIZARD_PACKAGE_IDS = PACKAGES.map((p) => p.id);
