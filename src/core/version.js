/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** package.json'daki surum; !bot-bilgi ve /health ciktilari kullanir. */
export const VERSION = require('../../package.json').version;
