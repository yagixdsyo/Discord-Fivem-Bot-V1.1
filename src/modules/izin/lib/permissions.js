/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ChannelType, PermissionsBitField } from 'discord.js';

/** [izin, riskPuani, aciklama] */
export const DANGEROUS_BITS = [
  ['Administrator', 90, 'Sunucuda tum yetkileri verir ve bot korumalarini devre disi birakir.'],
  ['ManageGuild', 70, 'Sunucu ayarlarini, guvenlik ve entegrasyon ayarlarini degistirebilir.'],
  ['ManageRoles', 65, 'Rol olusturup degistirebilir; hiyerarsi dogru degilse yetki yukseltebilir.'],
  ['ManageChannels', 60, 'Kanal olusturup izinlerini degistirebilir.'],
  ['BanMembers', 55, 'Uyeleri kalici olarak yasaklayabilir.'],
  ['MentionEveryone', 50, 'Herkesi etiketleyerek toplu spam yapabilir.'],
  ['KickMembers', 50, 'Uyeleri sunucudan atabilir.'],
  ['ManageWebhooks', 45, 'Webhook olusturup bot gibi mesaj gonderebilir.'],
  ['ModerateMembers', 40, 'Uyelere zaman asimi uygulayabilir.'],
  ['ManageMessages', 35, 'Baskalarinin mesajlarini silebilir ve pinleyebilir.'],
  ['ManageNicknames', 25, 'Uye takma adlarini degistirebilir.'],
  ['ManageEmojisAndStickers', 25, 'Sunucu emoji ve stickerlarini yonetebilir.'],
];

export function isScannableChannel(channel) {
  if (!channel) return false;
  if (channel.type === ChannelType.GuildCategory) return false;
  return Boolean(channel.permissionOverwrites?.cache);
}

/** Riskli rolleri agirlikli puanla dondurur. */
export function scanRoles(guild) {
  const rows = [];
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id) continue;
    const findings = [];
    let score = 0;
    for (const [flag, weight, why] of DANGEROUS_BITS) {
      if (role.permissions.has(flag)) {
        findings.push({ flag, weight, why });
        score += weight;
      }
    }
    if (findings.length === 0) continue;
    if (role.managed) score = Math.round(score * 0.5);
    rows.push({ role, score, findings, memberCount: role.members.size });
  }
  return rows.sort((a, b) => b.score - a.score);
}

/** Tehlikeli kanal gecersiz kilmalarini ve ad ipuclarini puanlar. */
export function scanChannels(guild) {
  const rows = [];
  for (const channel of guild.channels.cache.values()) {
    if (!isScannableChannel(channel)) continue;
    const findings = [];
    let score = 0;
    const name = String(channel.name ?? '');
    const announcementLike = /(duyuru|announce|haber|bilgi)/i.test(name);
    const sensitiveLike = /(log|kayit|yonetim|yönetim|admin|mod|basvuru|başvuru|ticket|destek)/i.test(name);
    const everyone = guild.roles.everyone;
    const everyoneOverwrite = channel.permissionOverwrites.cache.get(everyone.id);
    const everyoneAllow = everyoneOverwrite?.allow ?? new PermissionsBitField(0n);
    if (announcementLike && everyoneAllow.has('SendMessages')) {
      score += 70;
      findings.push({ flag: 'SendMessages', text: 'Duyuru benzeri kanalda herkes yazabiliyor.' });
    }
    if (sensitiveLike && everyoneAllow.has('ViewChannel')) {
      score += 40;
      findings.push({ flag: 'ViewChannel', text: 'Hassas kanal adiyla eslesen kanal herkese acik.' });
    }
    for (const overwrite of channel.permissionOverwrites.cache.values()) {
      const dangerous = DANGEROUS_BITS.filter(([flag]) => overwrite.allow.has(flag));
      if (dangerous.length > 0) {
        score += Math.min(45, dangerous.reduce((sum, [, weight]) => sum + Math.round(weight / 3), 0));
        findings.push({
          flag: dangerous[0][0],
          text: `${overwriteTargetName(guild, overwrite.id)} kanal ozelinde ${dangerous.map(([flag]) => flag).join(', ')} iznine sahip.`,
        });
      }
    }
    if (score > 0) rows.push({ channel, score, findings });
  }
  return rows.sort((a, b) => b.score - a.score);
}

export function overwriteTargetName(guild, id) {
  if (id === guild.roles.everyone.id) return '@everyone';
  const role = guild.roles.cache.get(id);
  if (role) return `@${role.name}`;
  const member = guild.members.cache.get(id);
  if (member) return member.user?.username ?? id;
  return id;
}

/**
 * Etkin izinleri Discord algoritmasiyla hesaplar:
 * @everyone rolu -> @everyone gecersiz kilmasi -> uye rolleri (dusukten yuksege) ve
 * rol gecersiz kilmalari -> uye ozel gecersiz kilmasi -> Administrator bypass.
 */
export function computeEffectivePermissions(member, channel) {
  const guild = channel.guild;
  const everyone = guild.roles.everyone;
  const steps = [];
  let perms = new PermissionsBitField(everyone.permissions);
  steps.push({ source: '@everyone rolu', kind: 'base', flags: perms.toArray() });

  const apply = (source, overwrite) => {
    if (!overwrite) return;
    perms = perms.remove(overwrite.deny).add(overwrite.allow);
    steps.push({ source, kind: 'overwrite', allow: overwrite.allow.toArray(), deny: overwrite.deny.toArray() });
  };

  apply('@everyone kanal izni', channel.permissionOverwrites.cache.get(everyone.id));

  const roles = [...member.roles.cache.values()]
    .filter((role) => role.id !== everyone.id)
    .sort((a, b) => a.position - b.position);
  for (const role of roles) {
    perms = perms.add(role.permissions);
    steps.push({ source: `@${role.name}`, kind: 'role', flags: role.permissions.toArray() });
    apply(`@${role.name} kanal izni`, channel.permissionOverwrites.cache.get(role.id));
  }

  apply('uye ozel izni', channel.permissionOverwrites.cache.get(member.id));

  const admin = perms.has('Administrator');
  if (admin) perms = new PermissionsBitField(PermissionsBitField.All);
  return { permissions: perms, steps, admin };
}

/** Iki rolun izin kumelerini karsilastirir. */
export function comparePermissionSets(roleA, roleB) {
  const a = new PermissionsBitField(roleA.permissions);
  const b = new PermissionsBitField(roleB.permissions);
  const aList = a.toArray().sort();
  const bList = b.toArray().sort();
  return {
    common: aList.filter((flag) => b.has(flag)),
    onlyA: aList.filter((flag) => !b.has(flag)),
    onlyB: bList.filter((flag) => !a.has(flag)),
  };
}

/** Kanal gecersiz kilmalarinda tehlikeli/gereksiz izinleri bulur. */
export function analyzeOverwrites(channel) {
  const guild = channel.guild;
  const suggestions = [];
  for (const overwrite of channel.permissionOverwrites.cache.values()) {
    const targetName = overwriteTargetName(guild, overwrite.id);
    const role = guild.roles.cache.get(overwrite.id);
    const dangerousAllow = DANGEROUS_BITS
      .filter(([flag]) => overwrite.allow.has(flag))
      .map(([flag, weight, why]) => ({ flag, weight, why }));
    const redundantAllow = Boolean(
      role
      && role.id !== guild.roles.everyone.id
      && !overwrite.deny.bitfield
      && overwrite.allow.toArray().length > 0
      && overwrite.allow.toArray().every((flag) => role.permissions.has(flag)),
    );
    if (dangerousAllow.length > 0 || redundantAllow) {
      suggestions.push({
        targetName,
        targetId: overwrite.id,
        dangerousAllow,
        redundantAllow,
        allow: overwrite.allow.toArray(),
        deny: overwrite.deny.toArray(),
      });
    }
  }
  return suggestions.sort((a, b) => b.dangerousAllow.length - a.dangerousAllow.length);
}
