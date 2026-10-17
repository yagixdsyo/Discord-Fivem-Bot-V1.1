/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

const UNIT_MS = {
  sn: 1000,
  s: 1000,
  dk: 60_000,
  d: 60_000,
  sa: 3_600_000,
  h: 3_600_000,
  g: 86_400_000,
};

const MAX_MS = 3650 * 86_400_000; // 10 yil

/**
 * Sure metnini ms'e cevirir. Ornekler: "10dk", "2s", "3g", "1g 12sa", "45".
 * Birimsiz sayi DAKIKA olarak yorumlanir. Gecersizse null.
 * Kabul edilen birimler: sn/saniye/s, dk/dakika/d, sa/saat/h, g/gun/gün.
 */
export function parseDuration(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number' && Number.isFinite(input)) {
    return clampMs(Math.round(input * 60_000));
  }

  const text = String(input).trim().toLocaleLowerCase('tr');
  if (!text) return null;

  // Birimsiz saf sayi -> dakika
  if (/^\d+$/.test(text)) {
    return clampMs(Number(text) * 60_000);
  }

  const re = /(\d+)\s*(saniye|sn|s|dakika|dk|d|saat|sa|h|gün|gun|g)\b/g;
  let total = 0;
  let matched = false;
  let match;
  while ((match = re.exec(text)) !== null) {
    matched = true;
    const amount = Number(match[1]);
    const unit = match[2];
    const unitMs =
      unit === 'saniye' ? UNIT_MS.sn
        : unit === 'dakika' ? UNIT_MS.dk
          : unit === 'saat' ? UNIT_MS.sa
            : unit === 'gün' || unit === 'gun' ? UNIT_MS.g
              : UNIT_MS[unit];
    if (!unitMs) return null;
    total += amount * unitMs;
  }
  if (!matched || total <= 0) return null;
  return clampMs(total);
}

function clampMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.min(ms, MAX_MS);
}

/** ms'i "3 gün 2 saat 5 dk" bicimine cevirir. */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0 sn';
  const parts = [];
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  if (days > 0) parts.push(`${days} gün`);
  if (hours > 0) parts.push(`${hours} saat`);
  if (minutes > 0) parts.push(`${minutes} dk`);
  if (seconds > 0 && parts.length < 3) parts.push(`${seconds} sn`);
  return parts.slice(0, 3).join(' ') || '0 sn';
}

/** "<@123>", "<@!123>" veya "123" -> "123" (gecersizse null). */
export function parseUserId(input) {
  if (!input) return null;
  const text = String(input).trim();
  const mention = /^<@!?(\d{15,20})>$/.exec(text);
  if (mention) return mention[1];
  if (/^\d{15,20}$/.test(text)) return text;
  return null;
}

/** Diziyi n'li parcalara boler. */
export function chunk(list, size) {
  const out = [];
  for (let index = 0; index < list.length; index += size) {
    out.push(list.slice(index, index + size));
  }
  return out;
}

let counter = 0;

/** Ceza kayit kimligi: c-<base36 zaman>-<sira>. */
export function makeCaseId() {
  counter = (counter + 1) % 0xffff;
  return `c-${Date.now().toString(36)}-${counter.toString(36)}`;
}

/** Gun anahtari (YYYY-MM-DD) - Europe/Istanbul. */
export function dayKey(date = new Date(), timeZone = 'Europe/Istanbul') {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    return parts;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Bugunden geriye n gunluk anahtar listesi (en eski ilk). */
export function lastNDayKeys(n, endDate = new Date()) {
  const keys = [];
  for (let index = n - 1; index >= 0; index -= 1) {
    keys.push(dayKey(new Date(endDate.getTime() - index * 86_400_000)));
  }
  return keys;
}

/** Izin bitfield'indan guvenli BigInt. */
export function toBigInt(value) {
  try {
    return BigInt(value ?? 0);
  } catch {
    return 0n;
  }
}
