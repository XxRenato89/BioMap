/**
 * Lados en que puede salir una ficha desde su punto, en orden de preferencia.
 */
const SIDES = ['top', 'right', 'left', 'bottom'];

/**
 * Desplazamientos a lo largo del lado (fracción del tamaño de la ficha) que se
 * prueban cuando dos puntos están muy juntos. El centrado tiene preferencia.
 */
const SLIDES = [0, -0.3, 0.3];
const SLIDE_PENALTY = 4000;

/*
 * Bono (fracción del área de la ficha) por quedarse en el lado y la posición
 * que ya tenía: la ficha no salta de lado por un movimiento pequeño de la cámara.
 */
const STICKINESS = 0.35;
const PIN = { width: 72, height: 96 };
const TAIL = 26;

/**
 * Área en que se superponen dos rectángulos.
 */
export function overlap(a, b) {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Rectángulo de la ficha si sale por `side` desde el alfiler anclado en (x, y),
 * donde (x, y) es la base del alfiler en pantalla.
 */
function rectFor(side, { x, y }, card, gap, slide) {
  const middleX = x - card.width / 2 + slide * card.width;
  const middleY = y - PIN.height / 2 - card.height / 2 + slide * card.height;
  switch (side) {
    case 'top':
      return { left: middleX, top: y - PIN.height - gap - card.height };
    case 'bottom':
      return { left: middleX, top: y + gap };
    case 'right':
      return { left: x + PIN.width / 2 + gap, top: middleY };
    default:
      return { left: x - PIN.width / 2 - gap - card.width, top: middleY };
  }
}

/**
 * Posición de la cola (rombo que apunta al alfiler) dentro de la ficha.
 */
function tailFor(side, anchor, rect, card) {
  const alongX = clamp(anchor.x - rect.left - TAIL / 2, 24, card.width - TAIL - 24);
  const alongY = clamp(
    anchor.y - PIN.height / 2 - rect.top - TAIL / 2,
    24,
    card.height - TAIL - 24,
  );
  switch (side) {
    case 'top':
      return { left: alongX, top: card.height - TAIL / 2 };
    case 'bottom':
      return { left: alongX, top: -TAIL / 2 };
    case 'right':
      return { left: -TAIL / 2, top: alongY };
    default:
      return { left: card.width - TAIL / 2, top: alongY };
  }
}

/**
 * Coloca las fichas abiertas junto a sus puntos. Cada ficha prueba los cuatro
 * lados, centrada o deslizada a lo largo de cada uno, y elige la posición que
 * menos choca con los paneles, con las fichas ya colocadas, con los alfileres
 * de las otras fichas y con los bordes de la pantalla. Las fichas se colocan
 * en el orden recibido (la del frente al final).
 *
 * @param {Array<{ id: number, x: number, y: number }>} anchors
 * @param {{ card: { width: number, height: number }, viewport: { width: number, height: number },
 *   obstacles?: Array<{ left: number, top: number, width: number, height: number }>,
 *   previous?: Record<number, { side: string, slide: number }>,
 *   gap?: number, margin?: number }} options `previous`: dónde estaba cada ficha.
 */
export function placeCards(
  anchors,
  { card, viewport, obstacles = [], previous = {}, gap = 20, margin = 16 },
) {
  const placed = [];
  const pins = anchors.map(({ x, y }) => ({
    left: x - PIN.width / 2,
    top: y - PIN.height,
    width: PIN.width,
    height: PIN.height,
  }));
  const screen = { left: 0, top: 0, ...viewport };

  return anchors.map((anchor, index) => {
    const offscreen =
      anchor.x < 0 || anchor.y < 0 || anchor.x > viewport.width || anchor.y > viewport.height;
    let best = null;
    const candidates = SIDES.flatMap((side) => SLIDES.map((slide) => ({ side, slide })));
    candidates.forEach(({ side, slide }) => {
      const raw = { ...rectFor(side, anchor, card, gap, slide), ...card };
      const outside = card.width * card.height - overlap(raw, screen);
      const rect = {
        ...raw,
        left: clamp(raw.left, margin, viewport.width - card.width - margin),
        top: clamp(raw.top, margin, viewport.height - card.height - margin),
      };
      const stay = previous[anchor.id];
      const sticky =
        stay && stay.side === side && stay.slide === slide
          ? STICKINESS * card.width * card.height
          : 0;
      const score =
        -sticky +
        Math.abs(slide) * SLIDE_PENALTY +
        outside * 2 +
        obstacles.reduce((sum, obstacle) => sum + overlap(rect, obstacle) * 3, 0) +
        placed.reduce((sum, other) => sum + overlap(rect, other) * 2, 0) +
        pins.reduce((sum, pin, i) => (i === index ? sum : sum + overlap(rect, pin)), 0);
      if (!best || score < best.score) best = { side, slide, rect, score };
    });
    placed.push(best.rect);
    return {
      id: anchor.id,
      side: best.side,
      slide: best.slide,
      left: Math.round(best.rect.left),
      top: Math.round(best.rect.top),
      tail: tailFor(best.side, anchor, best.rect, card),
      offscreen,
    };
  });
}
