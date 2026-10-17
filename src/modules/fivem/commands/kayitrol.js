/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { getCollection, isDbReady } from '../../../db/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { getWelcomeConfig, setWelcomeConfig } from '../../moderation/lib/welcome.js';
import { createDbStore } from '../../setup/lib/store.js';
import { clearMapsCache, getRoleId } from '../lib/maps.js';

const store = createDbStore();

async function clearMap(guildId, key) {
  if (!isDbReady()) return false;
  try {
    await getCollection('roles_map').deleteOne({ guild_id: guildId, key });
    return true;
  } catch {
    return false;
  }
}

async function configCard(t, guild) {
  const kayitli = await getRoleId(guild.id, 'kayitli');
  const kayitsiz = await getRoleId(guild.id, 'kayitsiz');
  const cfg = await getWelcomeConfig(guild.id).catch(() => ({ autoroleId: null }));
  const yok = t('fivem.kayit.role_none');
  const durum = (id) => (id ? `<@&${id}>` : yok);

  return card({
    emojiKey: 'ROL',
    title: t('fivem.kayit.role_card_title'),
    subtitle: t('fivem.kayit.role_card_sub', { sunucu: guild.name }),
    lines: [
      t('fivem.kayit.role_card_verilecek', { rol: durum(kayitli) }),
      t('fivem.kayit.role_card_alinacak', { rol: durum(kayitsiz) }),
      t('fivem.kayit.role_card_otorol', { rol: durum(cfg.autoroleId) }),
      t('fivem.kayit.role_card_hint'),
    ],
    accent: 'primary',
    footer: t('fivem.kayit.role_card_footer'),
  });
}

export default {
  name: 'kayıt-rol',
  aliases: ['kayitrol', 'kayit-rol'],
  description: 'Kayıt rol ayarları: verilecek rol, alınacak rol ve otorol (argümansız: gösterir).',
  category: 'FiveM',
  system: 'kayit',
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'verilecek', type: 'role', required: false, description: 'Kayıt olunca verilecek rol (kayıtlı)' },
    { name: 'alinacak', type: 'role', required: false, description: 'Kayıt olunca alınacak rol (kayıtsız)' },
    { name: 'otorol', type: 'role', required: false, description: 'Sunucuya katılınca verilecek otorol' },
    { name: 'islem', type: 'rest', required: false, description: '"kaldir verilecek|alinacak|otorol" ayarı temizler' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const guild = ctx.guild;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const verilecek = ctx.args.verilecek ?? null;
    const alinacak = ctx.args.alinacak ?? null;
    const otorol = ctx.args.otorol ?? null;
    const islem = String(ctx.args.islem ?? '').trim();

    // Argümansız: mevcut ayarları göster.
    if (!verilecek && !alinacak && !otorol && !islem) {
      await ctx.reply(await configCard(t, guild));
      return;
    }

    const me = guild.members.me;
    const changed = [];

    const roleTooHigh = (role) => !me || me.roles.highest.position <= role.position;

    if (verilecek) {
      if (roleTooHigh(verilecek)) {
        await ctx.reply(errorTemplate(t('fivem.kayit.role_too_high_title'), [t('fivem.kayit.role_too_high')]));
        return;
      }
      await store.setMap('roles_map', { guild_id: guild.id, key: 'kayitli', role_id: verilecek.id });
      changed.push(t('fivem.kayit.role_set_verilecek', { rol: `<@&${verilecek.id}>` }));
    }

    if (alinacak) {
      if (roleTooHigh(alinacak)) {
        await ctx.reply(errorTemplate(t('fivem.kayit.role_too_high_title'), [t('fivem.kayit.role_too_high')]));
        return;
      }
      await store.setMap('roles_map', { guild_id: guild.id, key: 'kayitsiz', role_id: alinacak.id });
      changed.push(t('fivem.kayit.role_set_alinacak', { rol: `<@&${alinacak.id}>` }));
    }

    if (otorol) {
      if (roleTooHigh(otorol)) {
        await ctx.reply(errorTemplate(t('fivem.kayit.role_too_high_title'), [t('fivem.kayit.role_too_high')]));
        return;
      }
      await setWelcomeConfig(guild.id, { autoroleId: otorol.id });
      changed.push(t('fivem.kayit.role_set_otorol', { rol: `<@&${otorol.id}>` }));
    }

    if (islem) {
      const which = islem.replace(/^kald[iı]r\s*/i, '').trim().toLocaleLowerCase('tr');
      if (which === 'verilecek') {
        await clearMap(guild.id, 'kayitli');
        changed.push(t('fivem.kayit.role_removed_verilecek'));
      } else if (which === 'alinacak') {
        await clearMap(guild.id, 'kayitsiz');
        changed.push(t('fivem.kayit.role_removed_alinacak'));
      } else if (which === 'otorol') {
        await setWelcomeConfig(guild.id, { autoroleId: null });
        changed.push(t('fivem.kayit.role_removed_otorol'));
      } else {
        await ctx.reply(errorTemplate(t('fivem.kayit.role_usage_title'), [t('fivem.kayit.role_usage')]));
        return;
      }
    }

    clearMapsCache();

    await emitLog(guild, 'log_kayit', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [t('fivem.kayit.role_log', { degisim: changed.join(' · ') })],
      accent: 'info',
    });

    await ctx.followUp(
      card({
        emojiKey: 'ROL',
        title: t('fivem.kayit.role_saved_title'),
        lines: changed,
        accent: 'success',
      }),
    );
    await ctx.followUp(await configCard(t, guild)).catch(() => {});
  },
};
