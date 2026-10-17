/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

const UNIT_MS = {
  s: 1000,
  sn: 1000,
  sec: 1000,
  m: 60_000,
  dk: 60_000,
  min: 60_000,
  h: 3_600_000,
  sa: 3_600_000,
  d: 86_400_000,
  g: 86_400_000,
  w: 604_800_000,
  hafta: 604_800_000,
};

const DURATION_PART_RE = /(\d+)\s*(hafta|sec|min|sn|sa|dk|s|m|h|d|g|w)/gi;

/** '3 gün 2 saat' bicimli Turkce gosterim. */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0 sn';
  const units = [
    [86_400_000, 'gün'],
    [3_600_000, 'saat'],
    [60_000, 'dk'],
    [1000, 'sn'],
  ];
  let remaining = ms;
  const parts = [];
  for (const [unitMs, label] of units) {
    const count = Math.floor(remaining / unitMs);
    if (count > 0) {
      parts.push(`${count} ${label}`);
      remaining -= count * unitMs;
    }
  }
  return parts.join(' ');
}

/**
 * Sure coz: '30s', '10m', '2h', '3d', '1w', '1d 2h', '2sa 30dk' vb.
 * Ciplak sayi DAKIKA kabul edilir: '30' -> 30 dakika.
 * @returns {{ms: number, display: string} | null}
 */
export function parseDuration(input) {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim().toLowerCase();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const minutes = Number.parseInt(raw, 10);
    if (minutes <= 0) return null;
    const ms = minutes * 60_000;
    return { ms, display: formatDuration(ms) };
  }

  let total = 0;
  let lastIndex = 0;
  let matched = false;
  const re = new RegExp(DURATION_PART_RE.source, 'gi');
  let m;
  while ((m = re.exec(raw)) !== null) {
    const between = raw.slice(lastIndex, m.index).trim();
    if (between.length > 0) return null; // '10mx5' gibi bozuk girdi
    const unit = m[2].toLowerCase();
    const unitMs = UNIT_MS[unit];
    if (!unitMs) return null;
    total += Number.parseInt(m[1], 10) * unitMs;
    lastIndex = re.lastIndex;
    matched = true;
  }
  const tail = raw.slice(lastIndex).trim();
  if (!matched || tail.length > 0 || total <= 0) return null;

  return { ms: total, display: formatDuration(total) };
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/** Tirnak dostu tokenizer: .rolver @user "rol adi" ek bilgi -> ['@user', 'rol adi', 'ek', 'bilgi'] */
export function tokenize(input) {
  const tokens = [];
  let current = '';
  let quote = null;

  for (const ch of String(input ?? '')) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

/** ID listesi: virgul, noktali virgul, bosluk ve satirlari tek bicime indirger. */
export function parseSnowflakeList(input) {
  const parts = String(input ?? '')
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const ids = parts.filter((p) => /^\d{15,25}$/.test(p));
  return { ids, invalid: parts.filter((p) => !/^\d{15,25}$/.test(p)) };
}

// ---------------------------------------------------------------------------
// Etiket / isim cozumleyiciler (guild baglami gerekir)
// ---------------------------------------------------------------------------

function extractId(token, patterns) {
  for (const re of patterns) {
    const m = re.exec(token);
    if (m) return m[1];
  }
  if (/^\d{15,25}$/.test(token)) return token;
  return null;
}

async function resolveMember(token, guild) {
  const id = extractId(token, [/^<@!?(\d+)>$/]);
  if (id) {
    const cached = guild.members.cache.get(id);
    if (cached) return cached;
    try {
      return await guild.members.fetch(id);
    } catch {
      return null;
    }
  }

  const query = token.replace(/^@/, '').toLowerCase();
  if (!query) return null;

  const exact = guild.members.cache.find(
    (m) => m.user.username.toLowerCase() === query || (m.displayName ?? '').toLowerCase() === query,
  );
  if (exact) return exact;

  const starts = guild.members.cache.find(
    (m) => m.user.username.toLowerCase().startsWith(query) || (m.displayName ?? '').toLowerCase().startsWith(query),
  );
  if (starts) return starts;

  try {
    const fetched = await guild.members.fetch({ query, limit: 5 });
    return fetched.first() ?? null;
  } catch {
    return null;
  }
}

async function resolveUser(token, guild, client) {
  const member = await resolveMember(token, guild);
  if (member) return member.user;

  const id = extractId(token, [/^<@!?(\d+)>$/]);
  if (id && client) {
    try {
      return await client.users.fetch(id);
    } catch {
      return null;
    }
  }
  return null;
}

function resolveRole(token, guild) {
  const id = extractId(token, [/^<@&(\d+)>$/]);
  if (id) return guild.roles.cache.get(id) ?? null;

  const query = token.replace(/^@/, '').toLowerCase();
  if (!query) return null;
  return (
    guild.roles.cache.find((r) => r.name.toLowerCase() === query) ??
    guild.roles.cache.find((r) => r.name.toLowerCase().startsWith(query)) ??
    null
  );
}

function resolveChannel(token, guild, { voiceOnly = false } = {}) {
  const id = extractId(token, [/^<#(\d+)>$/]);
  let channel = null;

  if (id) {
    channel = guild.channels.cache.get(id) ?? null;
  } else {
    const query = token.replace(/^#/, '').toLowerCase();
    if (query) {
      channel =
        guild.channels.cache.find((c) => c.name?.toLowerCase() === query) ??
        guild.channels.cache.find((c) => c.name?.toLowerCase().startsWith(query)) ??
        null;
    }
  }

  if (!channel) return { channel: null };
  if (voiceOnly && !channel.isVoiceBased?.()) return { channel: null, typeMismatch: true };
  return { channel };
}

const BOOLEAN_MAP = {
  true: true, '1': true, evet: true, e: true, ac: true, aç: true, aktif: true, on: true, var: true,
  sifirla: true, 'sıfırla': true,
  false: false, '0': false, hayir: false, hayır: false, h: false, kapat: false, kapali: false, kapalı: false, off: false, yok: false,
};

// ---------------------------------------------------------------------------
// Arguman cozumleme (ana giris)
// ---------------------------------------------------------------------------

/**
 * Tek token'i arguman tanimina gore cozer.
 * @returns {{value?: unknown, error?: {code: string, token: string}}}
 */
async function resolveToken(def, token, { guild, client, message }) {
  switch (def.type) {
    case 'user': {
      if (!guild) return { error: { code: 'user_not_found', token } };
      const member = await resolveMember(token, guild);
      if (member) return { value: member };
      const user = await resolveUser(token, guild, client);
      return user ? { value: user } : { error: { code: 'user_not_found', token } };
    }
    case 'member': {
      const member = await resolveMember(token, guild);
      return member ? { value: member } : { error: { code: 'member_not_found', token } };
    }
    case 'role': {
      const role = resolveRole(token, guild);
      return role ? { value: role } : { error: { code: 'role_not_found', token } };
    }
    case 'channel': {
      const { channel } = resolveChannel(token, guild);
      return channel ? { value: channel } : { error: { code: 'channel_not_found', token } };
    }
    case 'voiceChannel': {
      const { channel, typeMismatch } = resolveChannel(token, guild, { voiceOnly: true });
      if (channel) return { value: channel };
      return { error: { code: typeMismatch ? 'channel_type_mismatch' : 'voice_channel_not_found', token } };
    }
    case 'integer': {
      if (/^-?\d+$/.test(token)) return { value: Number.parseInt(token, 10) };
      return { error: { code: 'integer_invalid', token } };
    }
    case 'number': {
      const value = Number(token);
      if (Number.isFinite(value)) return { value };
      return { error: { code: 'number_invalid', token } };
    }
    case 'boolean': {
      const value = BOOLEAN_MAP[token.toLowerCase()];
      return value === undefined ? { error: { code: 'boolean_invalid', token } } : { value };
    }
    case 'string':
      return { value: token };
    case 'duration': {
      const parsed = parseDuration(token);
      return parsed ? { value: parsed } : { error: { code: 'duration_invalid', token } };
    }
    case 'choice': {
      const choices = def.choices ?? [];
      const match = choices.find(
        (c) =>
          String(typeof c === 'string' ? c : c.value).toLowerCase() === token.toLowerCase() ||
          String(typeof c === 'string' ? c : c.name).toLowerCase() === token.toLowerCase(),
      );
      if (!match) {
        return {
          error: {
            code: 'choice_invalid',
            token,
            options: choices.map((c) => (typeof c === 'string' ? c : c.name)).join(', '),
          },
        };
      }
      return { value: typeof match === 'string' ? match : match.value };
    }
    case 'attachment': {
      if (/^https?:\/\//i.test(token)) return { value: { url: token } };
      if ((token === '-' || token === 'ek') && message?.attachments?.size > 0) {
        const att = message.attachments.first();
        return { value: { url: att.url, name: att.name, size: att.size, contentType: att.contentType } };
      }
      return { error: { code: 'attachment_invalid', token } };
    }
    default:
      return { value: token };
  }
}

/**
 * Prefix komut argumanlarini cozer.
 * @param {{command: object, tokens: string[], message?: object, guild?: object, client?: object}} opts
 * @returns {Promise<{ok: boolean, args: Record<string, unknown>, errors: Array<{arg: string, code: string, token?: string, options?: string}>}>}
 */
export async function parseArgs({ command, tokens, message, guild, client }) {
  const defs = command.args ?? [];
  const args = {};
  const errors = [];
  let cursor = 0;

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const isLast = i === defs.length - 1;
    const remaining = tokens.length - cursor;

    const consumesAll = (def.type === 'rest' || def.type === 'snowflakeList') && isLast;

    if (remaining === 0) {
      if (def.required) errors.push({ arg: def.name, code: 'required_missing' });
      continue;
    }

    if (consumesAll) {
      if (def.type === 'rest') {
        args[def.name] = tokens.slice(cursor).join(' ');
        cursor = tokens.length;
      } else {
        const raw = tokens.slice(cursor).join(' ');
        const { ids } = parseSnowflakeList(raw);
        cursor = tokens.length;
        if (ids.length === 0) errors.push({ arg: def.name, code: 'snowflake_list_empty' });
        else args[def.name] = ids;
      }
      continue;
    }

    const token = tokens[cursor];
    const resolved = await resolveToken(def, token, { guild, client, message });
    if (resolved.error) {
      // Opsiyonel orta arguman cozulemedi ve sonraki arguman 'rest' ise:
      // token'i rest'e birak (or. ".ban @uye sebep yazisi" - sure atlanir).
      const nextDef = defs[i + 1];
      const nextIsLastRest =
        !def.required && nextDef && i + 1 === defs.length - 1 && (nextDef.type === 'rest' || nextDef.type === 'snowflakeList');
      if (nextIsLastRest) continue;

      errors.push({ arg: def.name, ...resolved.error });
      cursor += 1; // hatali token tuketilir, sira kaymaz
    } else {
      args[def.name] = resolved.value;
      cursor += 1;
    }
  }

  const extra = tokens.slice(cursor);
  if (extra.length > 0) args.__extra = extra;

  return { ok: errors.length === 0, args, errors };
}

/**
 * Slash etkilesiminden ayni args seklini uretir (tek tanim, iki adapter).
 * @param {object} interaction
 * @param {Array<object>} defs aktif arguman tanimlari (alt komut seciliyse sub.args)
 * @returns {{ok: boolean, args: Record<string, unknown>, errors: Array<object>}}
 */
export function argsFromInteraction(interaction, defs = []) {
  const args = {};
  const errors = [];

  for (const def of defs) {
    const options = interaction.options;
    let value;

    switch (def.type) {
      case 'user':
      case 'member':
        value = options.getMember(def.name) ?? options.getUser(def.name) ?? null;
        break;
      case 'role':
        value = options.getRole(def.name);
        break;
      case 'channel':
      case 'voiceChannel':
        value = options.getChannel(def.name);
        break;
      case 'integer':
        value = options.getInteger(def.name);
        break;
      case 'number':
        value = options.getNumber(def.name);
        break;
      case 'boolean':
        value = options.getBoolean(def.name);
        break;
      case 'duration': {
        const raw = options.getString(def.name);
        if (raw) {
          const parsed = parseDuration(raw);
          if (!parsed) errors.push({ arg: def.name, code: 'duration_invalid', token: raw });
          else value = parsed;
        }
        break;
      }
      case 'snowflakeList': {
        const raw = options.getString(def.name);
        if (raw) {
          const { ids } = parseSnowflakeList(raw);
          if (ids.length === 0) errors.push({ arg: def.name, code: 'snowflake_list_empty' });
          else value = ids;
        }
        break;
      }
      case 'attachment': {
        const att = options.getAttachment(def.name);
        if (att) value = { url: att.url, name: att.name, size: att.size, contentType: att.contentType };
        break;
      }
      case 'string':
      case 'rest':
      case 'choice':
      default:
        value = options.getString(def.name);
        break;
    }

    if (value === undefined || value === null) {
      if (def.required) errors.push({ arg: def.name, code: 'required_missing' });
      continue;
    }
    args[def.name] = value;
  }

  return { ok: errors.length === 0, args, errors };
}

// ---------------------------------------------------------------------------
// Kullanim metni
// ---------------------------------------------------------------------------

function argPlaceholder(arg) {
  return arg.required ? `<${arg.name}>` : `[${arg.name}]`;
}

/** '/ban <kullanici> [sure] [sebep]' bicimli kullanim satiri(lari). */
export function buildUsageString(command, prefix = '/') {
  const head = prefix === '/' ? `/${command.name}` : `${prefix}${command.name}`;

  if (command.subcommands && command.subcommands.length > 0) {
    return command.subcommands
      .map((sub) => {
        const parts = [`${head} ${sub.name}`];
        for (const arg of sub.args ?? []) parts.push(argPlaceholder(arg));
        return parts.join(' ');
      })
      .join('\n');
  }

  const parts = [head];
  for (const arg of command.args ?? []) parts.push(argPlaceholder(arg));
  return parts.join(' ');
}
