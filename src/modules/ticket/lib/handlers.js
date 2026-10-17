/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerComponentHandler } from '../../../ui/interactionRouter.js';
import { createTranslator } from '../../../locales/index.js';
import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { systemReady } from '../../fivem/lib/gate.js';
import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import {
  addParticipant,
  claimTicket,
  getTicket,
  getTicketByIdOnly,
  listNotes,
  markNote,
  rateTicket,
  removeParticipant,
  reopenTicket,
} from './tickets.js';

const ready = { done: false };

export function registerTicketHandlers() {
  if (ready.done) return;
  ready.done = true;

  registerComponentHandler('ticket', async (interaction, rest) => {
    const t = createTranslator();
    const [action, ticketId, extra] = rest;

    if (action === 'puan' && !interaction.guildId) {
      const doc = await getTicketByIdOnly(ticketId).catch(() => null);
      if (doc) {
        const score = Number(rest[2]);
        await rateTicket(doc.guild_id, ticketId, { score }).catch(() => {});
      }
      if (interaction.isRepliable?.()) {
        const done = success(t('ticket.rated_title'), [t('ticket.rated', { puan: rest[2] })]);
        if (interaction.isMessageComponent?.()) {
          // DM mesajini tesekkur kartiyla degistir (butonlar kalkar).
          await interaction.update(done).catch(() => {});
        } else {
          await interaction.reply({ ...done, ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    if (interaction.guildId && !(await systemReady(interaction.guildId, 'ticket'))) {
      await interaction.reply(errorTemplate(t('ticket.system_off_title'), [t('ticket.system_off')], { ephemeral: true })).catch(() => {});
      return;
    }

    const category = rest[1] ?? interaction.values?.[0] ?? 'destek';
    if (action === 'ac') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const { openTicket } = await import('./open.js');
      const result = await openTicket(interaction.guild, interaction.user, { category });
      if (result.ok) {
        await interaction.editReply(success(t('ticket.opened_title'), [t('ticket.opened_link', { kanal: `<#${result.channel.id}>` })], { ephemeral: true })).catch(() => {});
      } else if (result.existing) {
        const existing = interaction.guild.channels.cache.get(result.existing.channel_id);
        await interaction.editReply(errorTemplate(t('ticket.already_open_title'), [t('ticket.already_open', { kanal: existing ? `<#${existing.id}>` : result.existing.ticket_id })])).catch(() => {});
      } else {
        await interaction.editReply(errorTemplate(t('ticket.open_fail_title'), [t('ticket.open_fail')])).catch(() => {});
      }
      return;
    }

    const doc = interaction.guildId
      ? await getTicket(interaction.guildId, ticketId).catch(() => null)
      : await getTicketByIdOnly(ticketId).catch(() => null);
    if (!doc) {
      await interaction.reply(errorTemplate(t('ticket.not_found_title'), [t('ticket.not_found')], { ephemeral: true })).catch(() => {});
      return;
    }

    if (action === 'sahiplen') {
      if (doc.claimed_by && doc.claimed_by !== interaction.user.id) {
        await interaction.reply(errorTemplate(t('ticket.claim_taken_title'), [t('ticket.claim_taken')], { ephemeral: true })).catch(() => {});
        return;
      }
      await cbClaim(interaction, doc);
      return;
    }

    if (action === 'kapat') {
      await cbClose(interaction, doc);
      return;
    }

    if (action === 'geriac') {
      const result = await reopenTicket(interaction.guildId, doc.ticket_id, { by: interaction.user.id });
      if (result.ok) {
        // Kapatmada alinan yazma iznini geri ver.
        const ch = interaction.guild.channels.cache.get(doc.channel_id) ?? (await interaction.guild.channels.fetch(doc.channel_id).catch(() => null));
        if (ch?.permissionOverwrites) await ch.permissionOverwrites.edit(doc.user_id, { ViewChannel: true, SendMessages: true }).catch(() => {});
        await interaction.reply(success(t('ticket.reopened_title'), [t('ticket.reopened')], { ephemeral: true })).catch(() => {});
      } else {
        await interaction.reply(errorTemplate(t('ticket.close_fail_title'), [t('ticket.close_fail')], { ephemeral: true })).catch(() => {});
      }
      return;
    }

    if (action === 'uekle') {
      const modal = buildMemberModal('ticketmodal:uekle:' + doc.ticket_id, t('ticket.add_member_title'));
      await interaction.showModal(modal).catch(() => {});
      return;
    }

    if (action === 'ucikar') {
      const modal = buildMemberModal('ticketmodal:ucikar:' + doc.ticket_id, t('ticket.remove_member_title'));
      await interaction.showModal(modal).catch(() => {});
      return;
    }

    if (action === 'isim') {
      const modal = buildNameModal(doc);
      await interaction.showModal(modal).catch(() => {});
      return;
    }

    if (action === 'devret') {
      const modal = buildTransferModal(doc);
      await interaction.showModal(modal).catch(() => {});
      return;
    }

    if (action === 'notlar') {
      const modal = buildNoteModal(doc, t);
      await interaction.showModal(modal).catch(() => {});
      return;
    }

    if (action === 'pano') {
      const notes = await listNotes(interaction.guildId, doc.ticket_id, { limit: 20 });
      const body = notes.length ? notes.map((n) => `**<@${n.by}>** · ${n.note}`).join('\n') : t('ticket.no_notes');
      await interaction.reply(success(t('ticket.notes_title'), [body], { ephemeral: true })).catch(() => {});
      return;
    }
  });

  registerComponentHandler('ticketmodal', async (interaction, rest) => {
    const t = createTranslator();
    const [action, ticketId] = rest;
    const doc = await getTicket(interaction.guildId, ticketId).catch(() => null);

    if (!doc) {
      await interaction.reply(errorTemplate(t('ticket.not_found_title'), [t('ticket.not_found')], { ephemeral: true })).catch(() => {});
      return;
    }

    if (action === 'uekle') {
      const id = interaction.fields.getTextInputValue('uye').trim();
      await addParticipant(interaction.guildId, ticketId, id).catch(() => {});
      const ch = interaction.guild.channels.cache.get(doc.channel_id) ?? (await interaction.guild.channels.fetch(doc.channel_id).catch(() => null));
      if (ch) await ch.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: true }).catch(() => {});
      await interaction.reply(success(t('ticket.member_added_title'), [t('ticket.member_added', { kullanici: `<@${id}>` })], { ephemeral: true })).catch(() => {});
      return;
    }

    if (action === 'ucikar') {
      const id = interaction.fields.getTextInputValue('uye').trim();
      await removeParticipantSafe(interaction, doc, id);
      await interaction.reply(success(t('ticket.member_removed_title'), [t('ticket.member_removed', { kullanici: `<@${id}>` })], { ephemeral: true })).catch(() => {});
      return;
    }

    if (action === 'isim') {
      const name = interaction.fields.getTextInputValue('isim').trim();
      await renameChannel(interaction.guild, doc, name);
      await interaction.reply(success(t('ticket.renamed_title'), [t('ticket.renamed', { isim: name })], { ephemeral: true })).catch(() => {});
      return;
    }

    if (action === 'devret') {
      const id = interaction.fields.getTextInputValue('yetkili').trim();
      const cleaned = id.replace(/^<@!?/, '').replace(/>$/, '');
      await updateTicketClaimed(doc, cleaned);
      await interaction.reply(success(t('ticket.transferred_title'), [t('ticket.transferred', { yetkili: `<@${cleaned}>` })], { ephemeral: true })).catch(() => {});
      return;
    }

    if (action === 'notlar') {
      const note = interaction.fields.getTextInputValue('not');
      await markNote(interaction.guildId, doc.ticket_id, { by: interaction.user.id, note });
      await interaction.reply(success(t('ticket.note_added_title'), [t('ticket.note_added')], { ephemeral: true })).catch(() => {});
      return;
    }
  });
}

async function cbClaim(interaction, doc) {
  const t = createTranslator();
  const result = await claimTicket(interaction.guildId, doc.ticket_id, { by: interaction.user.id });
  if (!result.ok) {
    await interaction.reply(errorTemplate(t('ticket.claim_taken_title'), [t('ticket.claim_taken')], { ephemeral: true })).catch(() => {});
    return;
  }
  // claimed message via bot impersonation: tell users someone owns
  try {
    const ch = interaction.guild.channels.cache.get(doc.channel_id) ?? (await interaction.guild.channels.fetch(doc.channel_id));
    await ch.send(success(t('ticket.claimed_banner_title'), [t('ticket.claimed_banner', { yetkili: interaction.user.toString() })], { ephemeral: false })).catch(() => {});
  } catch {}
  await interaction.reply(success(t('ticket.claimed_title'), [t('ticket.claimed', { yetkili: interaction.user.toString() })], { ephemeral: true })).catch(() => {});
}

async function cbClose(interaction, doc) {
  const t = createTranslator();
  const { getTicketConfig } = await import('./config.js');
  const cfg = await getTicketConfig(interaction.guildId);
  const isStaff = (cfg.staffRoles ?? []).some((r) => interaction.member?.roles?.cache?.has?.(r));
  if (!isStaff && doc.user_id !== interaction.user.id) {
    await interaction.reply(errorTemplate(t('ticket.perm_title'), [t('ticket.perm_body')], { ephemeral: true })).catch(() => {});
    return;
  }
  if (!isStaff && cfg.allowMemberClose === false) {
    await interaction
      .reply(errorTemplate(t('ticket.no_member_close_title'), [t('ticket.no_member_close')], { ephemeral: true }))
      .catch(() => {});
    return;
  }

  await interaction.deferReply({ ephemeral: true }).catch(() => {});
  const { finalizeTicketClose } = await import('./closeFlow.js');
  const result = await finalizeTicketClose({
    guild: interaction.guild,
    client: interaction.client,
    doc,
    by: interaction.user.id,
    reason: isStaff ? 'yetkili' : 'sahip',
    t,
  });
  if (!result.ok) {
    await interaction
      .editReply(errorTemplate(t('ticket.close_fail_title'), [t('ticket.close_fail')]))
      .catch(() => {});
    return;
  }

  const lines = [t('ticket.closed', { kanal: `#${result.channelName ?? doc.channel_id}` })];
  if (result.logChannelId) lines.push(t('ticket.closed_log_line', { kanal: `<#${result.logChannelId}>` }));
  lines.push(t('ticket.closed_delete'));
  await interaction.editReply(success(t('ticket.closed_title'), lines)).catch(() => {});
}

async function removeParticipantSafe(interaction, doc, id) {
  await removeParticipant(interaction.guildId, doc.ticket_id, id).catch(() => {});
  const channel = interaction.guild.channels.cache.get(doc.channel_id) ?? (await interaction.guild.channels.fetch(doc.channel_id).catch(() => null));
  if (channel?.permissionOverwrites?.delete) await channel.permissionOverwrites.delete(id).catch(() => {});
}

async function updateTicketClaimed(doc, cleaned) {
  const { setClaimed } = await import('./tickets.js');
  await setClaimed(doc.guild_id, doc.ticket_id, cleaned).catch(() => {});
}

async function renameChannel(guild, doc, name) {
  const channel = guild.channels.cache.get(doc.channel_id) ?? (await guild.channels.fetch(doc.channel_id).catch(() => null));
  if (channel?.setName) await channel.setName(name.slice(0, 95)).catch(() => {});
}

// modal builders
function buildMemberModal(customId, title) {
  const t = createTranslator();
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('uye').setLabel(t('ticket.member_id_label')).setStyle(TextInputStyle.Short).setRequired(true),
      ),
    );
}
function buildNameModal(doc) {
  const t = createTranslator();
  return new ModalBuilder()
    .setCustomId(`ticketmodal:isim:${doc.ticket_id}`)
    .setTitle(t('ticket.rename_title'))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('isim').setLabel(t('ticket.new_name_label')).setStyle(TextInputStyle.Short).setRequired(true),
      ),
    );
}
function buildTransferModal(doc) {
  const t = createTranslator();
  return new ModalBuilder()
    .setCustomId(`ticketmodal:devret:${doc.ticket_id}`)
    .setTitle(t('ticket.transfer_title'))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('yetkili').setLabel(t('ticket.transfer_target')).setStyle(TextInputStyle.Short).setRequired(true),
      ),
    );
}
function buildNoteModal(doc, translator) {
  const t = createTranslator();
  return new ModalBuilder()
    .setCustomId(`ticketmodal:notlar:${doc.ticket_id}`)
    .setTitle(t('ticket.note_title'))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('not').setLabel(t('ticket.note_label')).setStyle(TextInputStyle.Paragraph).setRequired(true),
      ),
    );
}
