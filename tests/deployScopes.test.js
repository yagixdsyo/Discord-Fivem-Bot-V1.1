/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import { GLOBAL_LIMIT, GUILD_LIMIT, MODULE_PRIORITY, deployCommands, splitCommandScopes } from '../src/core/commandDeployer.js';
import { buildSlashCommand } from '../src/core/slashBuilder.js';

function makeCommands(n, moduleName, prefix = 'cmd') {
  return Array.from({ length: n }, (_, i) => ({
    name: `${prefix}-${String(i).padStart(3, '0')}`,
    description: 'test komutu',
    module: moduleName,
    args: [],
    permission: {},
  }));
}

describe('komut kapsam bolme', () => {
  it('100 global + 100 guild + kalan prefix-only', () => {
    const cmds = makeCommands(250, 'fun', 'x');
    const { global, guild, prefixOnly, total } = splitCommandScopes(cmds);
    expect(total).toBe(250);
    expect(global.length).toBe(GLOBAL_LIMIT);
    expect(guild.length).toBe(GUILD_LIMIT);
    expect(prefixOnly.length).toBe(50);
  });

  it('modul onceligine gore siralar (core once, fun sonra)', () => {
    const cmds = [...makeCommands(120, 'fun', 'z'), ...makeCommands(120, 'core', 'a')];
    const { global, guild, prefixOnly } = splitCommandScopes(cmds);
    expect(global.every((c) => c.module === 'core')).toBe(true);
    expect(guild.filter((c) => c.module === 'core').length).toBe(20);
    expect(prefixOnly.every((c) => c.module === 'fun')).toBe(true);
    expect(prefixOnly.length).toBe(40);
  });

  it('ownerOnly komutlari disarida tutar', () => {
    const cmds = [
      ...makeCommands(5, 'core', 'c'),
      { name: 'owner-x', description: 'd', module: 'core', ownerOnly: true },
    ];
    const { total } = splitCommandScopes(cmds);
    expect(total).toBe(5);
  });

  it('terfi ve rooms modulleri oncelik listesindedir (slash gorunurlugu)', () => {
    // terfi (yetkili*) ve oda komutlari slash kapsamina girmeli.
    expect(MODULE_PRIORITY).toContain('terfi');
    expect(MODULE_PRIORITY).toContain('rooms');
    expect(MODULE_PRIORITY.indexOf('terfi')).toBeLessThan(MODULE_PRIORITY.indexOf('fun'));
    expect(MODULE_PRIORITY.indexOf('rooms')).toBeLessThan(MODULE_PRIORITY.indexOf('fun'));
  });
});

describe('deployCommands', () => {
  function fakeClient() {
    const state = { global: null, guildSets: [] };
    return {
      state,
      application: {
        id: 'app1',
        commands: {
          async set(body) {
            state.global = body;
            return new Map(body.map((b) => [b.name, b]));
          },
        },
      },
      guilds: {
        cache: new Map([
          [
            'g1',
            {
              id: 'g1',
              commands: {
                async set(body) {
                  state.guildSets.push({ id: 'g1', body });
                  return new Map(body.map((b) => [b.name, b]));
                },
              },
            },
          ],
        ]),
      },
    };
  }

  it('global ve guild kapsamlarini ayri kaydeder, isimler cakismaz', async () => {
    const client = fakeClient();
    const cmds = makeCommands(230, 'moderation', 'm');

    const result = await deployCommands(client, cmds);

    expect(result.global).toBe(GLOBAL_LIMIT);
    expect(result.guild).toBe(GUILD_LIMIT);
    expect(result.prefixOnly).toBe(30);
    expect(client.state.global.length).toBe(GLOBAL_LIMIT);
    expect(client.state.guildSets.length).toBe(1);
    expect(client.state.guildSets[0].body.length).toBe(GUILD_LIMIT);

    const globalNames = new Set(client.state.global.map((b) => b.name));
    for (const entry of client.state.guildSets[0].body) {
      expect(globalNames.has(entry.name)).toBe(false);
    }
  });

  it('limit icinde kalan komutlar guild kapsamina yazilmaz', async () => {
    const client = fakeClient();
    const cmds = makeCommands(80, 'core', 'c');

    const result = await deployCommands(client, cmds);

    expect(result.global).toBe(80);
    expect(result.guild).toBe(0);
    expect(result.prefixOnly).toBe(0);
    expect(client.state.guildSets.length).toBe(0);
  });
});

describe('slash govdesi - zorunlu secenek sirasi (Discord kurali)', () => {
  it('serbest seceneklerden sonra gelen zorunlu secenekler slash govdesinde one tasinir', async () => {
    const cmd = {
      name: 'test-oylama',
      description: 'd',
      args: [
        { name: 'soru', type: 'string', required: true },
        { name: 'sure', type: 'duration', required: false },
        { name: 'kanal', type: 'channel', required: false },
        { name: 'secenekler', type: 'rest', required: true },
      ],
    };
    const json = buildSlashCommand(cmd).toJSON();
    expect(json.options.map((o) => o.name)).toEqual(['soru', 'secenekler', 'sure', 'kanal']);
    expect(json.options.slice(0, 2).every((o) => o.required === true)).toBe(true);
    // Prefix konum sirasi korunur (tanim degismedi)
    expect(cmd.args.map((a) => a.name)).toEqual(['soru', 'sure', 'kanal', 'secenekler']);
  });

  it('alt komut secenekleri de zorunlu-once sirasina gore uretilir', () => {
    const cmd = {
      name: 'test-alt',
      description: 'd',
      subcommands: [
        {
          name: 'ekle',
          description: 'd',
          args: [
            { name: 'not', type: 'string', required: false },
            { name: 'kisi', type: 'user', required: true },
          ],
        },
      ],
    };
    const json = buildSlashCommand(cmd).toJSON();
    const sub = json.options.find((o) => o.name === 'ekle');
    expect(sub.options.map((o) => o.name)).toEqual(['kisi', 'not']);
    expect(sub.options[0].required).toBe(true);
  });

  it('gercek komutlar (kurallar-kur, oylama) gecerli govde uretir', async () => {
    const { default: kurallarKur } = await import('../src/modules/fivem/commands/kurallarkur.js');
    const { default: oylama } = await import('../src/modules/fivem/commands/oylama.js');
    for (const cmd of [kurallarKur, oylama]) {
      const options = buildSlashCommand(cmd).toJSON().options;
      const firstOptional = options.findIndex((o) => !o.required);
      if (firstOptional >= 0) {
        expect(
          options.slice(firstOptional).every((o) => !o.required),
          `${cmd.name}: zorunlu secenek serbest secenekten sonra kalamaz`,
        ).toBe(true);
      }
    }
  });
});
