import { describe, expect, it } from 'vitest';
import { overlap, placeCards } from './cardPlacement.js';

const CARD = { width: 460, height: 440 };
const VIEWPORT = { width: 1920, height: 1080 };
const options = (extra = {}) => ({ card: CARD, viewport: VIEWPORT, ...extra });
const rect = (p) => ({ left: p.left, top: p.top, ...CARD });

describe('overlap', () => {
  it('measures the shared area, zero when apart', () => {
    const a = { left: 0, top: 0, width: 10, height: 10 };
    expect(overlap(a, { left: 5, top: 5, width: 10, height: 10 })).toBe(25);
    expect(overlap(a, { left: 20, top: 0, width: 5, height: 5 })).toBe(0);
  });
});

describe('placeCards', () => {
  it('opens above a point in the middle of the screen', () => {
    const [card] = placeCards([{ id: 1, x: 960, y: 800 }], options());
    expect(card.side).toBe('top');
    expect(card.left).toBe(960 - 230);
    expect(card.top + CARD.height).toBeLessThanOrEqual(800 - 96);
    expect(card.tail.top).toBe(CARD.height - 13);
  });

  it('opens below a point near the top edge', () => {
    const [card] = placeCards([{ id: 1, x: 960, y: 200 }], options());
    expect(card.side).toBe('bottom');
    expect(card.top).toBeGreaterThanOrEqual(200);
  });

  it('avoids the side panels', () => {
    const panel = { left: 0, top: 0, width: 480, height: 1080 };
    const [card] = placeCards([{ id: 1, x: 560, y: 560 }], options({ obstacles: [panel] }));
    expect(overlap(rect(card), panel)).toBe(0);
    expect(card.side).toBe('right');
  });

  it('places two cards on nearby points without overlapping each other', () => {
    const cards = placeCards(
      [
        { id: 1, x: 900, y: 700 },
        { id: 2, x: 1000, y: 720 },
      ],
      options(),
    );
    expect(overlap(rect(cards[0]), rect(cards[1]))).toBe(0);
  });

  it('keeps cards inside the screen and flags points that left it', () => {
    const [card] = placeCards([{ id: 1, x: 2400, y: 500 }], options());
    expect(card.left + CARD.width).toBeLessThanOrEqual(VIEWPORT.width);
    expect(card.offscreen).toBe(true);
  });

  it('keeps its previous side when that side still fits', () => {
    const anchor = { id: 1, x: 960, y: 800 };
    const [card] = placeCards([anchor], options({ previous: { 1: { side: 'right', slide: 0 } } }));
    expect(card.side).toBe('right');
  });
});
