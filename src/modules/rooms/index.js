/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { registerComponentHandler } from '../../ui/interactionRouter.js';
import { createTranslator } from '../../locales/index.js';
import { error as errorTemplate, success } from '../../ui/templates/index.js';
import { systemReady } from '../fivem/lib/gate.js';
import {
  banFromRoom,
  createRoom,
  deleteRoom,
  getRoom,
  getRoomByChannel,
  getRoomByOwner,
  inviteToRoom,
  kickFromRoom,
  lockRoom,
  postRoomPanel,
  refreshRoomPanel,
  renameRoom,
  setRoomLimit,
} from './lib/rooms.js';
import { registerRoomsSetupPanels } from './lib/setupPanels.js';

let ready = false;

function isOwnerOrManager(interaction, doc) {
  if (interaction.user.id === doc.owner_id) return true;
  return Boolean(interaction.memberPermissions?.has('ManageChannels'));
}

async function refreshPanel(interaction, doc) {
  const fresh = (await getRoom(interaction.guildId, doc.room_id).catch(() => null)) ?? doc;
  await refreshRoomPanel(interaction.guild, fresh, createTranslator()).catch(() => {});
}

function registerHandlers() {
  if (ready) return;
  ready = true;

  registerComponentHandler('oda', async (interaction, rest) => {
    const t = createTranslator();
    const [action, roomIdValue] = rest;

    if (!(await systemReady(interaction.guildId, 'ozel_oda'))) {
      await interaction.reply(errorTemplate(t('fivem.rooms.system_off_title'), [t('fivem.rooms.system_off')], { ephemeral: true })).catch(() => {});
      return;
    }

    if (action === 'olustur') {
      const existing = await getRoomByOwner(interaction.guildId, interaction.user.id).catch(() => null);
      if (existing) {
        const channel = interaction.guild.channels.cache.get(existing.channel_id);
        await interaction
          .reply(success(t('fivem.rooms.already_title'), [t('fivem.rooms.already', { oda: channel ? `<#${channel.id}>` : existing.name })], { ephemeral: true }))
          .catch(() => {});
        return;
      }

      const result = await createRoom(interaction.guild, interaction.user);
      if (!result.ok) {
        await interaction.reply(errorTemplate(t('fivem.rooms.create_fail_title'), [t('fivem.rooms.create_fail')], { ephemeral: true })).catch(() => {});
        return;
      }

      if (interaction.member?.voice?.channelId) {
        await interaction.member.voice.setChannel(result.channel).catch(() => {});
      }
      await postRoomPanel(interaction.guild, result.doc, t);
      await interaction
        .reply(success(t('fivem.rooms.created_title'), [t('fivem.rooms.created', { oda: `<#${result.channel.id}>` })], { ephemeral: true }))
        .catch(() => {});
      return;
    }

    const doc = await getRoom(interaction.guildId, roomIdValue).catch(() => null);
    if (!doc) {
      await interaction.reply(errorTemplate(t('fivem.rooms.not_found_title'), [t('fivem.rooms.not_found')], { ephemeral: true })).catch(() => {});
      return;
    }
    if (!isOwnerOrManager(interaction, doc)) {
      await interaction.reply(errorTemplate(t('fivem.rooms.not_owner_title'), [t('fivem.rooms.not_owner')], { ephemeral: true })).catch(() => {});
      return;
    }

    if (action === 'isim') {
      const modal = new ModalBuilder()
        .setCustomId(`odaisim:${doc.room_id}`)
        .setTitle(t('fivem.rooms.name_modal_title'))
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('isim')
              .setLabel(t('fivem.rooms.name_input'))
              .setStyle(TextInputStyle.Short)
              .setMaxLength(90)
              .setRequired(true)
              .setValue(doc.name.slice(0, 90)),
          ),
        );
      await interaction.showModal(modal).catch(() => {});
      return;
    }

    if (action === 'limit') {
      const modal = new ModalBuilder()
        .setCustomId(`odalimit:${doc.room_id}`)
        .setTitle(t('fivem.rooms.limit_modal_title'))
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('limit')
              .setLabel(t('fivem.rooms.limit_input'))
              .setStyle(TextInputStyle.Short)
              .setMaxLength(2)
              .setRequired(true)
              .setValue(String(doc.limit)),
          ),
        );
      await interaction.showModal(modal).catch(() => {});
      return;
    }

    if (action === 'kilit') {
      const result = await lockRoom(interaction.guild, doc, !doc.locked);
      if (result.ok) {
        await refreshPanel(interaction, { ...doc, locked: result.locked });
        await interaction
          .reply(
            success(t('fivem.rooms.lock_done_title'), [
              result.locked ? t('fivem.rooms.lock_done') : t('fivem.rooms.unlock_done'),
            ], { ephemeral: true }),
          )
          .catch(() => {});
      } else {
        await interaction.reply(errorTemplate(t('fivem.rooms.op_fail_title'), [t('fivem.rooms.op_fail')], { ephemeral: true })).catch(() => {});
      }
      return;
    }

    if (action === 'sil') {
      await deleteRoom(interaction.guild, doc, { reason: `Oda sahibi kapatti: ${interaction.user.id}` });
      await interaction.reply(success(t('fivem.rooms.deleted_title'), [t('fivem.rooms.deleted')], { ephemeral: true })).catch(() => {});
      return;
    }

    if (action === 'ekle' || action === 'davet' || action === 'cikar' || action === 'yasak') {
      const targetId = interaction.values?.[0];
      const member = targetId ? await interaction.guild.members.fetch(targetId).catch(() => null) : null;
      if (!member) {
        await interaction.reply(errorTemplate(t('fivem.rooms.op_fail_title'), [t('fivem.rooms.member_missing')], { ephemeral: true })).catch(() => {});
        return;
      }

      if (action === 'ekle' || action === 'davet') {
        const result = await inviteToRoom(interaction.guild, doc, member, interaction.user.id);
        if (result.ok) await refreshPanel(interaction, doc);
        await interaction
          .reply(
            result.ok
              ? success(t('fivem.rooms.invited_title'), [t('fivem.rooms.invited', { kullanici: `<@${member.id}>` })], { ephemeral: true })
              : errorTemplate(t('fivem.rooms.op_fail_title'), [t('fivem.rooms.op_fail')], { ephemeral: true }),
          )
          .catch(() => {});
        return;
      }

      if (action === 'cikar') {
        const result = await kickFromRoom(interaction.guild, doc, member, interaction.user.id);
        if (result.ok) await refreshPanel(interaction, doc);
        await interaction
          .reply(
            result.ok
              ? success(t('fivem.rooms.removed_title'), [t('fivem.rooms.removed', { kullanici: `<@${member.id}>` })], { ephemeral: true })
              : errorTemplate(t('fivem.rooms.op_fail_title'), [t('fivem.rooms.op_fail')], { ephemeral: true }),
          )
          .catch(() => {});
        return;
      }

      const result = await banFromRoom(interaction.guild, doc, member, interaction.user.id);
      if (result.ok) await refreshPanel(interaction, doc);
      await interaction
        .reply(
          result.ok
            ? success(t('fivem.rooms.banned_title'), [t('fivem.rooms.banned', { kullanici: `<@${member.id}>` })], { ephemeral: true })
            : errorTemplate(t('fivem.rooms.op_fail_title'), [t('fivem.rooms.op_fail')], { ephemeral: true }),
        )
        .catch(() => {});
    }
  });

  registerComponentHandler('odaisim', async (interaction, rest) => {
    const t = createTranslator();
    const [roomIdValue] = rest;
    const doc = await getRoom(interaction.guildId, roomIdValue).catch(() => null);
    if (!doc || !isOwnerOrManager(interaction, doc)) {
      await interaction.reply(errorTemplate(t('fivem.rooms.not_owner_title'), [t('fivem.rooms.not_owner')], { ephemeral: true })).catch(() => {});
      return;
    }
    const name = interaction.fields.getTextInputValue('isim');
    const result = await renameRoom(interaction.guild, doc, name);
    if (result.ok) {
      await refreshPanel(interaction, { ...doc, name: result.name });
      await interaction.reply(success(t('fivem.rooms.name_done_title'), [t('fivem.rooms.name_done', { isim: `**${result.name}**` })], { ephemeral: true })).catch(() => {});
    } else {
      await interaction.reply(errorTemplate(t('fivem.rooms.op_fail_title'), [t('fivem.rooms.op_fail')], { ephemeral: true })).catch(() => {});
    }
  });

  registerComponentHandler('odalimit', async (interaction, rest) => {
    const t = createTranslator();
    const [roomIdValue] = rest;
    const doc = await getRoom(interaction.guildId, roomIdValue).catch(() => null);
    if (!doc || !isOwnerOrManager(interaction, doc)) {
      await interaction.reply(errorTemplate(t('fivem.rooms.not_owner_title'), [t('fivem.rooms.not_owner')], { ephemeral: true })).catch(() => {});
      return;
    }
    const parsed = Number.parseInt(interaction.fields.getTextInputValue('limit'), 10);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 99) {
      await interaction.reply(errorTemplate(t('fivem.rooms.limit_invalid_title'), [t('fivem.rooms.limit_invalid')], { ephemeral: true })).catch(() => {});
      return;
    }
    const result = await setRoomLimit(interaction.guild, doc, parsed);
    if (result.ok) {
      await refreshPanel(interaction, { ...doc, limit: result.limit });
      await interaction.reply(success(t('fivem.rooms.limit_done_title'), [t('fivem.rooms.limit_done', { limit: `**${result.limit || t('fivem.rooms.unlimited')}**` })], { ephemeral: true })).catch(() => {});
    } else {
      await interaction.reply(errorTemplate(t('fivem.rooms.op_fail_title'), [t('fivem.rooms.op_fail')], { ephemeral: true })).catch(() => {});
    }
  });
}

export default {
  id: 'rooms',
  name: 'Özel Oda',
  description: 'Oyuncular için özel ses odaları (join-to-create, kontrol paneli).',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,

  async setup(client, { logger }) {
    registerHandlers();
    registerRoomsSetupPanels();
    logger.info('Ozel oda modulu hazir');
  },
};

// getRoomByChannel ve bagli yardimcilar event tarafinda kullanilir.
export { getRoomByChannel };
