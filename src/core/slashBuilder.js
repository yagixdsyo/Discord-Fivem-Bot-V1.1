/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ChannelType, SlashCommandBuilder } from 'discord.js';

/** Discord kurali: zorunlu secenekler serbest seceneklerden once gelmeli. */
function requiredFirst(args) {
  const required = [];
  const optional = [];
  for (const arg of args ?? []) {
    if (arg.required) required.push(arg);
    else optional.push(arg);
  }
  return [...required, ...optional];
}

function addOption(builder, arg) {
  const required = Boolean(arg.required);
  const description = String(arg.description ?? arg.name).slice(0, 100);

  switch (arg.type) {
    case 'user':
    case 'member':
      builder.addUserOption((o) => o.setName(arg.name).setDescription(description).setRequired(required));
      break;
    case 'role':
      builder.addRoleOption((o) => o.setName(arg.name).setDescription(description).setRequired(required));
      break;
    case 'channel':
      builder.addChannelOption((o) => o.setName(arg.name).setDescription(description).setRequired(required));
      break;
    case 'voiceChannel':
      builder.addChannelOption((o) =>
        o
          .setName(arg.name)
          .setDescription(description)
          .setRequired(required)
          .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice),
      );
      break;
    case 'integer':
      builder.addIntegerOption((o) => o.setName(arg.name).setDescription(description).setRequired(required));
      break;
    case 'number':
      builder.addNumberOption((o) => o.setName(arg.name).setDescription(description).setRequired(required));
      break;
    case 'boolean':
      builder.addBooleanOption((o) => o.setName(arg.name).setDescription(description).setRequired(required));
      break;
    case 'attachment':
      builder.addAttachmentOption((o) => o.setName(arg.name).setDescription(description).setRequired(required));
      break;
    case 'choice': {
      builder.addStringOption((o) => {
        o.setName(arg.name).setDescription(description).setRequired(required);
        o.addChoices(
          (arg.choices ?? []).map((c) =>
            typeof c === 'string' ? { name: c, value: c } : { name: c.name, value: c.value },
          ),
        );
        return o;
      });
      break;
    }
    case 'duration':
      builder.addStringOption((o) =>
        o
          .setName(arg.name)
          .setDescription(`${description} (or: 10m, 2h, 3d, 1w)`.slice(0, 100))
          .setRequired(required),
      );
      break;
    case 'rest':
      builder.addStringOption((o) =>
        o.setName(arg.name).setDescription(`${description} (kalan tum metin)`.slice(0, 100)).setRequired(required),
      );
      break;
    case 'snowflakeList':
      builder.addStringOption((o) =>
        o
          .setName(arg.name)
          .setDescription(`${description} (ID listesi: bosluk/virgul/satir)`.slice(0, 100))
          .setRequired(required),
      );
      break;
    case 'string':
    default:
      builder.addStringOption((o) => o.setName(arg.name).setDescription(description).setRequired(required));
      break;
  }
  return builder;
}

/** Tek komut tanimindan SlashCommandBuilder uretir. */
export function buildSlashCommand(command) {
  const builder = new SlashCommandBuilder()
    .setName(command.name)
    .setDescription(String(command.description ?? command.name).slice(0, 100));

  if (command.subcommands && command.subcommands.length > 0) {
    for (const sub of command.subcommands) {
      builder.addSubcommand((s) => {
        s.setName(sub.name).setDescription(String(sub.description ?? sub.name).slice(0, 100));
        for (const arg of requiredFirst(sub.args)) addOption(s, arg);
        return s;
      });
    }
  } else {
    for (const arg of requiredFirst(command.args)) addOption(builder, arg);
  }

  return builder;
}
