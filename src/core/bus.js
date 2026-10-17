/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { EventEmitter } from 'node:events';

export const bus = new EventEmitter();
bus.setMaxListeners(100);
