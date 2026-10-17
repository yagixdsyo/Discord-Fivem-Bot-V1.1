/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from './base.js';
import { buildUsageString } from '../../core/argParser.js';

const DEFAULT_LABELS = Object.freeze({
  title: 'Kullanim',
  description: 'Aciklama',
  args: 'Argumanlar',
  aliases: 'Kisayollar',
  examples: 'Ornekler',
  permission: 'Yetki',
  cooldown: 'Bekleme',
  module: 'Modul',
  required: 'zorunlu',
  optional: 'opsiyonel',
  none: 'yok',
});

/**
 * Kullanim karti - komut tanimindan OTOMATIK uretilir.
 * @param {object} command komut tanimi
 * @param {{ prefix?: string, labels?: object, note?: string }} [opts]
 */
export function usage(command, opts = {}) {
  const labels = { ...DEFAULT_LABELS, ...(opts.labels ?? {}) };
  const prefix = opts.prefix ?? '/';

  const title = `${labels.title}: ${prefix}${command.name}`;
  const lines = [];

  if (command.description) lines.push(command.description);

  const usageStr = buildUsageString(command, prefix);
  lines.push(`\`\`\`\n${usageStr}\n\`\`\``);

  if (command.args && command.args.length > 0) {
    const argLines = command.args.map((arg) => {
      const flag = arg.required ? labels.required : labels.optional;
      const desc = arg.description ? ` - ${arg.description}` : '';
      return `- \`${arg.name}\` (${arg.type}, ${flag})${desc}`;
    });
    lines.push(`**${labels.args}**\n${argLines.join('\n')}`);
  }

  if (command.subcommands && command.subcommands.length > 0) {
    const subLines = command.subcommands.map((sub) => {
      const subArgs = (sub.args ?? [])
        .map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
        .join(' ');
      return `- \`${prefix}${command.name} ${sub.name}${subArgs ? ` ${subArgs}` : ''}\` - ${sub.description ?? ''}`;
    });
    lines.push(`**Alt komutlar**\n${subLines.join('\n')}`);
  }

  if (command.aliases && command.aliases.length > 0) {
    lines.push(`**${labels.aliases}:** ${command.aliases.map((a) => `\`${opts.prefix ?? ''}${a}\``).join(', ')}`);
  }

  if (command.examples && command.examples.length > 0) {
    lines.push(`**${labels.examples}**\n${command.examples.map((e) => `- \`${e}\``).join('\n')}`);
  }

  const meta = [];
  if (command.permission?.node) meta.push(`**${labels.permission}:** \`${command.permission.node}\``);
  if (command.cooldown) meta.push(`**${labels.cooldown}:** ${command.cooldown} sn`);
  if (command.module) meta.push(`**${labels.module}:** \`${command.module}\``);
  if (meta.length > 0) lines.push(meta.join(' | '));

  if (opts.note) lines.push(opts.note);

  return card({ emojiKey: 'BELGE', title, lines, accent: 'info' });
}
