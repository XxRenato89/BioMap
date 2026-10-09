import { afterEach, describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';
import i18n, { layerName } from './index.js';

/**
 * Lista las claves de un objeto anidado como "a.b.c".
 */
function keys(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

afterEach(() => i18n.changeLanguage('es'));

describe('i18n', () => {
  it('has every Spanish text translated to English', () => {
    const english = new Set(keys(en));
    expect(keys(es).filter((key) => !english.has(key))).toEqual([]);
  });

  it('uses the database layer name in Spanish and the known translation in English', () => {
    const layer = { slug: 'history', name: 'Historia' };
    expect(layerName(i18n.t, layer)).toBe('Historia');
    i18n.changeLanguage('en');
    expect(layerName(i18n.t, layer)).toBe('History');
    expect(layerName(i18n.t, { slug: 'energy', name: 'Energía' })).toBe('Energía');
  });

  it('pluralizes counts', () => {
    expect(i18n.t('layers.count', { count: 1 })).toBe('1 punto');
    expect(i18n.t('layers.count', { count: 4 })).toBe('4 puntos');
  });
});
