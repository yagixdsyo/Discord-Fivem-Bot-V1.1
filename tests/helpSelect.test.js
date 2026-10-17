/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import { buildPage } from '../src/modules/core/commands/yardim.js';

const t = (key) => key;

function selectsOf(payload) {
  const root = payload.components?.[0];
  const tree = typeof root?.toJSON === 'function' ? root.toJSON() : root;
  const out = [];
  (function walk(node) {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (node.type === 3 && Array.isArray(node.options)) out.push(node);
    if (Array.isArray(node.components)) walk(node.components);
  })(tree);
  return out;
}

function build(categories, category = 'tumu') {
  return buildPage({
    t,
    all: [],
    categories,
    category,
    page: 0,
    ownerId: '123',
    prefixOnly: new Set(),
    prefixChar: '.',
  }).payload;
}

describe('yardim kategori select', () => {
  it('26 kategori -> 2 select; hicbiri 25 secenegi asmaz, idler essiz', () => {
    const categories = Array.from({ length: 26 }, (_, i) => `Kategori-${i + 1}`);
    const selects = selectsOf(build(categories));

    expect(selects.length).toBe(2);
    const ids = selects.map((s) => s.custom_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(selects[0].options.length).toBe(25);
    expect(selects[1].options.length).toBe(2);

    const values = selects.flatMap((s) => s.options.map((o) => o.value));
    expect(values).toEqual(['tumu', ...categories]);
  });

  it('az kategoride tek select kalir', () => {
    const selects = selectsOf(build(['A', 'B', 'C']));
    expect(selects.length).toBe(1);
    expect(selects[0].options.map((o) => o.value)).toEqual(['tumu', 'A', 'B', 'C']);
  });

  it('secili kategori kendi selectinde varsayilan isaretlenir', () => {
    const categories = Array.from({ length: 30 }, (_, i) => `Kategori-${i + 1}`);
    const selects = selectsOf(build(categories, 'Kategori-1'));
    const marked = selects
      .flatMap((s) => s.options)
      .filter((o) => o.default === true)
      .map((o) => o.value);
    expect(marked).toEqual(['Kategori-1']);
  });

  it('51+ kategoride ucuncu select de acilir ve limit asilmaz', () => {
    const categories = Array.from({ length: 60 }, (_, i) => `Kategori-${i + 1}`);
    const selects = selectsOf(build(categories));
    expect(selects.length).toBe(3);
    for (const select of selects) expect(select.options.length).toBeLessThanOrEqual(25);
    const values = selects.flatMap((s) => s.options.map((o) => o.value));
    expect(values.length).toBe(61);
    expect(values[0]).toBe('tumu');
  });
});
