import { describe, expect, it, vi } from 'vitest';
import { drawPostcard, parseStamps, stampsUrl, wrapWords } from './postcard.js';

describe('stamps in the QR address', () => {
  it('round-trips the earned stamps from the kiosk to the phone', () => {
    const url = stampsUrl('http://biomap.test/', [1, 6]);
    expect(url).toBe('http://biomap.test/?sellos=1,6');
    expect(parseStamps(new URL(url).search, [1, 6, 10, 16])).toEqual([1, 6]);
  });

  it('leaves the address alone when there are no stamps', () => {
    expect(stampsUrl('http://biomap.test', [])).toBe('http://biomap.test');
  });

  it('ignores ids that are not tour stops, and junk', () => {
    expect(parseStamps('?sellos=6,99,abc,,1', [1, 6, 10])).toEqual([1, 6]);
    expect(parseStamps('?point=3', [1, 6])).toEqual([]);
  });
});

describe('wrapWords', () => {
  it('breaks a long name into short lines', () => {
    expect(wrapWords('Sendero y Mirador Huequecura', 15)).toEqual([
      'Sendero y',
      'Mirador',
      'Huequecura',
    ]);
  });
});

describe('drawPostcard', () => {
  it('writes the title, the count and every stop name', () => {
    const fillText = vi.fn();
    const ctx = new Proxy(
      { fillText, createLinearGradient: () => ({ addColorStop() {} }) },
      { get: (target, key) => target[key] ?? (() => {}), set: () => true },
    );
    drawPostcard(ctx, {
      stamps: [
        { name: 'Parque Angostura', earned: true },
        { name: 'Playa Quilaco', earned: false },
      ],
      title: 'Pasaporte',
      count: '1 de 2 sellos',
      place: 'Centro',
      date: 'hoy',
    });
    const written = fillText.mock.calls.map(([text]) => text);
    expect(written).toEqual(
      expect.arrayContaining([
        'Pasaporte',
        '1 de 2 sellos',
        'PARQUE',
        'ANGOSTURA',
        'PLAYA QUILACO',
        '1',
        '?',
      ]),
    );
  });
});
