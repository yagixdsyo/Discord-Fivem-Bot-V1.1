/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { button, row } from '../../../ui/v2.js';

export default {
  name: 'rol-buton-paneli',
  aliases: [],
  description: 'Buton ile rol verme/alma paneli kurar.',
  category: 'FiveM',
  system: 'whitelist',
  cooldown: 10,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'kanal', type: 'channel', required: true, description: 'Panel kanali' },
    { name: 'butonlar', type: 'rest', required: true, description: 'rolId|Etiket|Renk (virgulle)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const channel = ctx.args.kanal;
    if (!channel?.isTextBased?.()) {
      await ctx.reply(errorTemplate(t('fivem.roles.panel_channel_bad_title'), [t('fivem.roles.panel_channel_bad')]));
      return;
    }

    const raw = String(ctx.args.butonlar ?? '').trim();
    const cleaned = raw.replace(/^<@&\d+>\s*/, '');
    const chunks = cleaned.split(/,\s*/).map((x) => x.trim()).filter(Boolean);
    const items = chunks.map((chunk) => {
      const [roleRaw, labelRaw, _color] = chunk.split('|').map((x) => String(x ?? '').trim());
      return { roleId: roleRaw.replace(/[^\d]/g, ''), label: labelRaw || roleRaw, color };
    }).filter((item) => item.roleId);

    if (!items.length) {
      await ctx.reply(errorTemplate(t('fivem.roles.panel_input_empty_title'), [t('fivem.roles.panel_input_empty')]));
      return;
    }

    const rolesById = new Map();
    for (const item of items) {
      const role = await ctx.guild.roles.fetch(item.roleId).catch(() => null);
      if (!role || role.managed) continue;
      rolesById.set(item.roleId, role);
    }
    if (!rolesById.size) {
      await ctx.reply(errorTemplate(t('fivem.roles.panel_no_valid_title'), [t('fivem.roles.panel_no_valid')]));
      return;
    }

    const unique = [...rolesById.values()];
    const rows = [];
    while (unique.length) {
      const slice = unique.splice(0, 5);
      rows.push(row(slice.map((role) => button({
        id: `rolbuton:toggle:${role.id}`,
        label: role.name.slice(0, 80),
        emojiKey: 'ROL',
        style: styleOf(role.color),
      }))));
    }

    const payload = card({
      emojiKey: 'ROL',
      title: t('fivem.roles.panel_title', { sunucu: ctx.guild.name }),
      lines: [t('fivem.roles.panel_line'), t('fivem.roles.panel_hint')],
      accent: 'primary',
      buttons: rows.map((component) => component),
    });

    const message = await channel.send(payload).catch(() => null);
    if (!message) {
      await ctx.reply(errorTemplate(t('fivem.roles.panel_post_fail_title'), [t('fivem.roles.panel_post_fail')]));
      return;
    }

    const { emitLog } = await import('../../logging/lib/emit.js');
    await emitLog(ctx.guild, 'log_rol_ver_al', {
      actor: (ctx.user.id),
      actorTag: ctx.user.username,
      lines: [t('fivem.roles.panel_log', { kanal: `<#${channel.id}>`, mesaj: `\`${message.id}\`` })],
      accent: 'info',
    }).catch(() => {});

    await ctx.reply(card({
      emojiKey: 'BASARI',
      title: t('fivem.roles.panel_done_title'),
      lines: [t('fivem.roles.panel_done', { kanal: `<#${channel.id}>`, mesaj: `\`${message.id}\`` })],
      accent: 'success',
    }));
  },
};

function styleOf(color) {
  const value = Number(color ?? 0);
  if (value === 0) return 'secondary';
  return value > 0xcccccc ? 'secondary' : 'primary';
}
