/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { registerComponentHandler } from '../../ui/interactionRouter.js';
import { createTranslator } from '../../locales/index.js';
import { error as errorTemplate } from '../../ui/templates/index.js';
import { card } from '../../ui/templates/base.js';

const ready = { done: false };
function registerHandlers() {
  if (ready.done) return;
  ready.done = true;
  registerComponentHandler('mazeret', async (interaction, rest) => {
    const [action, leaveId] = rest || [];
    const t = createTranslator();
    const lib = await import('./lib/shifts.js');
    const approved = action === 'onay';
    const ok = await lib.reviewLeave({ guildId: interaction.guildId, leaveId, reviewerId: interaction.user.id, approve: approved });
    if (!ok) {
      await interaction.reply(errorTemplate(t('shift.review_missing_title'), [t('shift.review_missing')], { ephemeral: true })).catch(() => {});
      return;
    }
    await interaction.reply(
      card({
        emojiKey: approved ? 'ONAY' : 'RED',
        title: t('shift.review_done_title'),
        lines: [approved ? t('shift.review_approved') : t('shift.review_rejected')],
        accent: approved ? 'success' : 'error',
        ephemeral: true,
      }),
    ).catch(() => {});
    const rows = await lib.listLeaves(interaction.guildId, { status: null, limit: 100 });
    const leave = rows.find((r) => r.leave_id === leaveId);
    if (leave?.user_id) {
      const user = await interaction.client.users.fetch(leave.user_id).catch(() => null);
      if (user) {
        const dm = card({
          emojiKey: approved ? 'ONAY' : 'RED',
          title: t('shift.review_dm_title'),
          lines: [t(approved ? 'shift.review_dm_approved' : 'shift.review_dm_rejected', { id: leaveId })],
          accent: approved ? 'success' : 'error',
        });
        await user.send(dm).catch(() => {});
      }
    }
  });

  registerComponentHandler('mesaibuton', async (interaction, rest) => {
    const [action, ownerId] = rest || [];
    const t = createTranslator();
    if (ownerId && interaction.user.id !== ownerId) {
      await interaction.reply(errorTemplate(t('shift.bulk_not_owner_title'), [t('shift.bulk_not_owner')], { ephemeral: true })).catch(() => {});
      return;
    }
    if (!interaction.member?.permissions?.has?.('ManageRoles')) {
      await interaction.reply(errorTemplate(t('shift.bulk_perm_title'), [t('shift.bulk_perm')], { ephemeral: true })).catch(() => {});
      return;
    }
    if (action === 'toplu-cikar') {
      const lib = await import('./lib/shifts.js');
      const rows = await lib.listActiveShifts(interaction.guildId).catch(() => []);
      let ended = 0;
      for (const r of rows) {
        const res = await lib.endShift({ guild: interaction.guild, userId: r.user_id, reason: 'toplu' }).catch(() => null);
        if (res?.ok) ended += 1;
      }
      await interaction.reply(
        card({
          emojiKey: 'MESAI',
          title: t('shift.bulk_done_title'),
          lines: [t('shift.bulk_done', { adet: ended })],
          accent: 'warn',
          ephemeral: true,
        }),
      ).catch(() => {});
    }
  });
}

export default {
  id: 'shift',
  name: 'Ekip / Mesai',
  description: 'Mesai, birim, mazeret, aktiflik testi ve yetkili ses sistemi.',
  botTypes: ['all'],
  defaultEnabled: true,
  coreModule: false,

  async setup(client, { logger }) {
    registerHandlers();
    setInterval(async () => {
      try {
        const lib = await import('./lib/shifts.js');
        const guilds = [...client.guilds.cache.values()];
        for (const guild of guilds) {
          const tests = await lib.getActiveActivityTests(guild.id).catch(() => []);
          for (const test of tests) {
            if (new Date(test.ends_at).getTime() > Date.now()) continue;
            await lib.finalizeActivityTest(client, guild.id, test.test_id).catch(() => {});
          }
        }
      } catch {}
    }, 30000);
    registerComponentHandler('aktiflik', async (interaction, rest) => {
      const [action, testId] = rest || [];
      const t = createTranslator();
      const lib = await import('./lib/shifts.js');
      if (action === 'katil') {
        const ok = await lib.recordActivityClick(interaction.guildId, testId, interaction.user.id);
        const payload = ok
          ? card({
              emojiKey: 'ETKINLIK',
              title: t('shift.activity_joined_title'),
              lines: [t('shift.activity_joined')],
              accent: 'success',
            })
          : errorTemplate(t('shift.activity_missing_title'), [t('shift.activity_missing')]);
        await interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
        return;
      }
      if (action === 'durum') {
        const docs = await lib.getActiveActivityTests(interaction.guildId).catch(() => []);
        const doc = docs.find((d) => d.test_id === testId);
        const payload = doc
          ? card({
              emojiKey: 'GRAFIK',
              title: t('shift.activity_status_title'),
              lines: [t('shift.activity_status', { adet: (doc.clicked ?? []).length })],
              accent: 'info',
            })
          : errorTemplate(t('shift.activity_missing_title'), [t('shift.activity_missing')]);
        await interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
        return;
      }
    });

    logger.info('Shift modulu hazir');

    const shifts = await import('./lib/shifts.js');
    // Ses toleransi: ses kanalından ayrilınca belirli sürede mesai otomatik biter.
    client.on('voiceStateUpdate', async (oldState, newState) => {
      if (!oldState?.member || !newState?.member) return;
      const member = oldState.member;
      const guild = oldState.guild;
      if (!guild) return;
      if (member.user?.bot) return;
      if (newState.channelId && oldState.channelId === newState.channelId) return;

      const cfg = await shifts.getShiftConfig(guild.id).catch(() => ({}));
      const autoChannels = cfg.autoStartVoiceChannelIds ?? [];
      const active = await shifts.findActiveShift(guild.id, member.id).catch(() => null);
      const exempt = (cfg.exemptRoleIds ?? []).some((r) => member.roles?.cache?.has?.(r));

      // Ayrintili ses bazli mesai baslangici (sadece bot uzerinden; site bagimli degil)
      if (!active && newState.channelId && autoChannels.includes(newState.channelId) && (await shifts.shouldAutoStartShift(member))) {
        const result = await shifts.startShift({ guild, member }).catch(() => null);
        if (result?.ok) {
          await shifts.recordVoiceSession({ guildId: guild.id, userId: member.id, channelId: newState.channelId, action: 'mesai-baslat-ses' }).catch(() => {});
        }
        if (!result?.ok || !result.doc) return;
        await shifts.cancelVoiceTolerance(guild.id, member.id);
        return;
      }
      if (!active) return;
      if (exempt) return;

      if (!newState.channelId) {
        await shifts.scheduleVoiceTolerance({ client, guildId: guild.id, userId: member.id, member }).catch(() => {});
      } else {
        await shifts.cancelVoiceTolerance(guild.id, member.id);
      }
      if (newState.channelId && newState.channelId !== active.voice_channel_id) {
        await shifts.recordVoiceSession({ guildId: guild.id, userId: member.id, channelId: newState.channelId, action: 'kanal-degisimi' }).catch(() => {});
      }
    });
  },
};
