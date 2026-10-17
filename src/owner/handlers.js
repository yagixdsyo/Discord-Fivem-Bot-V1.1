/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { reportError } from '../core/errorHandler.js';
import { isOwnerUser } from '../core/ownerRegistry.js';
import {
  createAnnouncement,
  findByShortId,
  setAnnouncementVisible,
  shortId,
  updateAnnouncement,
  validateAnnouncementInput,
  deleteAnnouncement,
} from '../core/announcements.js';
import { createTranslator } from '../locales/index.js';
import { registerComponentHandler } from '../ui/interactionRouter.js';
import { EPHEMERAL_FLAG } from '../ui/limits.js';
import { error as errorTemplate, info, success, warn } from '../ui/templates/index.js';
import { auditAction } from './lib/audit.js';
import { interactionConfirm } from './lib/confirm.js';
import { notifyGuildSystemChannel, notifyUserDm } from './lib/ownerLog.js';
import { addBlacklist } from './lib/state.js';
import { buildGuildDetailCard } from './lib/report.js';

let bound = { config: null, logger: null, t: null };

const asEphemeral = (payload) => ({ ...payload, flags: payload.flags | EPHEMERAL_FLAG });

/** Bootstrap bir kez cagirir. */
export function setupOwnerHandlers({ config, logger } = {}) {
  bound = { config: config ?? null, logger: logger ?? null, t: createTranslator('tr') };
  registerComponentHandler('owner', async (interaction, parts) => {
    try {
      if (!bound.config) return;

      const owner = await isOwnerUser(bound.config, interaction.user.id);
      if (!owner) return; // sessiz

      const [group, ...rest] = parts;
      if (group === 'srv') return await handleSrv(interaction, rest);
      if (group === 'duyuru') return await handleDuyuru(interaction, rest);
      if (group === 'dmodal') return await handleAnnouncementModal(interaction, rest);
    } catch (err) {
      await reportError(err, {
        source: 'owner_bilesen',
        guildId: interaction.guildId ?? null,
        userId: interaction.user?.id ?? null,
      });
      if (interaction.isRepliable?.() && !interaction.replied && !interaction.deferred) {
        await interaction
          .reply(asEphemeral(errorTemplate(bound.t?.('errors.unexpected.title') ?? 'Hata', [])))
          .catch(() => {});
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Sunucu islemleri
// ---------------------------------------------------------------------------

async function handleSrv(interaction, [action, guildId]) {
  const tFn = bound.t;
  const guild = interaction.client.guilds.cache.get(guildId) ?? (await interaction.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) {
    await interaction.reply(asEphemeral(info(tFn('owner.guild_not_found', { girdi: guildId }), [])));
    return;
  }

  if (action === 'detay') {
    const card = await buildGuildDetailCard({ guild, t: tFn });
    await interaction.reply(asEphemeral(card));
    return;
  }

  if (action === 'kara') {
    const approved = await interactionConfirm(interaction, {
      t: tFn,
      title: tFn('owner.confirm_blacklist_title'),
      description: [
        tFn('owner.confirm_blacklist_body', { sunucu: guild.name }),
      ],
      danger: true,
    });
    if (!approved) return;

    await addBlacklist({ guildId: guild.id, reason: tFn('owner.blacklist_reason_panel'), addedBy: interaction.user.id, notify: true });

    const dmCard = errorTemplate(tFn('owner.blacklist_dm_title'), [tFn('owner.blacklist_dm_body', { sunucu: guild.name })]);
    await notifyUserDm(bound.config, guild.ownerId, dmCard);
    await notifyGuildSystemChannel(guild, dmCard);

    await guild.leave().catch(() => {});
    await auditAction({
      config: bound.config,
      ownerId: interaction.user.id,
      action: 'kara-liste-ekle',
      target: guild.id,
      guildId: guild.id,
      payload: { source: 'panel' },
      t: tFn,
    });

    await interaction.editReply(asEphemeral(success(tFn('owner.blacklist_done', { sunucu: guild.name }), [])));
    return;
  }

  if (action === 'ayril') {
    const approved = await interactionConfirm(interaction, {
      t: tFn,
      title: tFn('owner.confirm_leave_title'),
      description: [tFn('owner.confirm_leave_body', { sunucu: guild.name })],
      danger: true,
    });
    if (!approved) return;

    await guild.leave().catch(() => {});
    await auditAction({
      config: bound.config,
      ownerId: interaction.user.id,
      action: 'sunucu-ayril',
      target: guild.id,
      guildId: guild.id,
      payload: { source: 'panel' },
      t: tFn,
    });
    await interaction.editReply(asEphemeral(success(tFn('owner.left_guild', { sunucu: guild.name }), [])));
  }
}

// ---------------------------------------------------------------------------
// Duyuru islemleri
// ---------------------------------------------------------------------------

async function handleDuyuru(interaction, [action, kind, ...rest]) {
  const tFn = bound.t;
  const ownerId = interaction.user.id;

  if (action === 'yaz') {
    await interaction.showModal(buildModal({ t: tFn, kind, ownerId, doc: null }));
    return;
  }

  if (action === 'duzenle') {
    const doc = await findByShortId(kind, rest[0]);
    if (!doc) {
      await interaction.reply(asEphemeral(info(tFn('owner.error_not_found', { kod: rest[0] }), [])));
      return;
    }
    await interaction.showModal(buildModal({ t: tFn, kind, ownerId, doc }));
    return;
  }

  if (action === 'gorunurluk') {
    const short = rest[0];
    const turnOn = rest[1] === 'on';
    const doc = await findByShortId(kind, short);
    if (!doc) {
      await interaction.reply(asEphemeral(info(tFn('owner.error_not_found', { kod: short }), [])));
      return;
    }
    await setAnnouncementVisible(doc._id, turnOn);
    await auditAction({
      config: bound.config,
      ownerId,
      action: turnOn ? `${kind}_duyuru-ac` : `${kind}_duyuru-kapat`,
      target: short,
      payload: { source: 'panel' },
      t: tFn,
    });
    await interaction.reply(asEphemeral(success(turnOn ? tFn('announce.visible_on') : tFn('announce.visible_off'), [])));
    return;
  }

  if (action === 'sil') {
    const short = rest[0];
    const doc = await findByShortId(kind, short);
    if (!doc) {
      await interaction.reply(asEphemeral(info(tFn('owner.error_not_found', { kod: short }), [])));
      return;
    }
    const approved = await interactionConfirm(interaction, {
      t: tFn,
      title: tFn('announce.confirm_delete_title'),
      description: [tFn('announce.confirm_delete_body', { baslik: doc.title })],
      danger: true,
    });
    if (!approved) return;

    await deleteAnnouncement(doc._id);
    await auditAction({
      config: bound.config,
      ownerId,
      action: `${kind}_duyuru-sil`,
      target: short,
      payload: { baslik: doc.title, source: 'panel' },
      t: tFn,
    });
    await interaction.editReply(asEphemeral(success(tFn('announce.deleted', { baslik: doc.title }), [])));
  }
}

// ---------------------------------------------------------------------------
// Duyuru modallari
// ---------------------------------------------------------------------------

function buildModal({ t: tFn, kind, ownerId, doc }) {
  const kindLabel = tFn(`announce.kind_${kind}`);
  const customId = doc
    ? `owner:dmodal:duzenle:${kind}:${shortId(doc)}:${ownerId}`
    : `owner:dmodal:yaz:${kind}:${ownerId}`;

  const titleInput = new TextInputBuilder()
    .setCustomId('baslik')
    .setLabel(tFn('announce.field_title'))
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);
  if (doc) titleInput.setValue(doc.title);

  const bodyInput = new TextInputBuilder()
    .setCustomId('icerik')
    .setLabel(tFn('announce.field_body'))
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000);
  if (doc) bodyInput.setValue(doc.body);

  const versionInput = new TextInputBuilder()
    .setCustomId('surum')
    .setLabel(tFn('announce.field_version'))
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(20);
  if (doc?.version) versionInput.setValue(String(doc.version));

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(tFn('announce.modal_title', { tur: kindLabel }).slice(0, 45))
    .addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(bodyInput),
      new ActionRowBuilder().addComponents(versionInput),
    );
}

const VALIDATION_KEYS = {
  title_empty: 'announce.error_title_empty',
  title_long: 'announce.error_title_long',
  body_empty: 'announce.error_body_empty',
  body_long: 'announce.error_body_long',
  version_invalid: 'announce.error_version_invalid',
};

async function handleAnnouncementModal(interaction, [mode, kind, ...rest]) {
  const tFn = bound.t;
  const ownerId = interaction.user.id;

  const title = interaction.fields.getTextInputValue('baslik');
  const body = interaction.fields.getTextInputValue('icerik');
  let version = null;
  try {
    version = interaction.fields.getTextInputValue('surum');
  } catch {
    version = null;
  }

  const check = validateAnnouncementInput({ title, body, version });
  if (!check.ok) {
    const lines = check.errors.map((code) => `- ${tFn(VALIDATION_KEYS[code] ?? 'owner.no_data')}`);
    await interaction.reply(asEphemeral(warn(tFn('announce.validation_failed'), lines)));
    return;
  }

  if (mode === 'yaz') {
    const result = await createAnnouncement({ kind, title, body, version, createdBy: ownerId });
    if (!result.ok) {
      await interaction.reply(asEphemeral(warn(tFn('owner.no_data'), [])));
      return;
    }
    await auditAction({
      config: bound.config,
      ownerId,
      action: `${kind}_duyuru-yaz`,
      target: result.shortId,
      payload: { baslik: title, surum: check.value.version },
      t: tFn,
    });
    await interaction.reply(
      asEphemeral(success(tFn('announce.created', { baslik: title, id: result.shortId }), [tFn('announce.created_hint')])),
    );
    return;
  }

  if (mode === 'duzenle') {
    const short = rest[0];
    const doc = await findByShortId(kind, short);
    if (!doc) {
      await interaction.reply(asEphemeral(info(tFn('owner.error_not_found', { kod: short }), [])));
      return;
    }
    await updateAnnouncement(doc._id, { title, body, version });
    await auditAction({
      config: bound.config,
      ownerId,
      action: `${kind}_duyuru-duzenle`,
      target: short,
      payload: { baslik: title, surum: check.value.version },
      t: tFn,
    });
    await interaction.reply(asEphemeral(success(tFn('announce.updated', { baslik: title }), [])));
  }
}

/** Test/temizlik icin baglami sifirlar. */
export function resetOwnerHandlers() {
  bound = { config: null, logger: null, t: null };
}
