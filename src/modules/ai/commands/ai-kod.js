/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';

export default {
  name: 'ai-kod',
  aliases: ['kod-analiz'],
  description: 'FiveM kodu inceler, optimize eder ve hata noktalarini listeler.',
  category: 'AI',
  system: null,
  cooldown: 5,
  permission: { discord: [] },
  args: [{ name: 'istek', type: 'rest', required: false, description: 'Kod veya istek' }],
  async run(ctx) {
    const t = ctx.t;
    return await runAiCommand(ctx, t, 'kod', 'FiveM kod inceleme istegi: ', ['Kod/metni girin.']);
  },
};
