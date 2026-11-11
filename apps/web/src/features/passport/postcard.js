import quibarRun from '../../assets/quibar-run.webp';

/* Postal vertical, buena para guardar y compartir desde el teléfono. */
export const POSTCARD = { width: 1080, height: 1350 };
/* Cuadros de la tira de Quibar corriendo: se dibuja solo el primero. */
const RUN_FRAMES = 12;
const DISPLAY = "'Bricolage Grotesque Variable', 'Atkinson Hyperlegible', sans-serif";
const BODY = "'Atkinson Hyperlegible', system-ui, sans-serif";
/* Inclinación de cada sello (grados), como timbrados a mano. */
const TILTS = [-10, 6, -4, 8];

/**
 * Dirección que lleva los sellos ganados del kiosco al teléfono (`?sellos=1,6`).
 *
 * @param {string} base
 * @param {number[]} ids
 */
export function stampsUrl(base, ids) {
  return ids.length > 0 ? `${base.replace(/\/$/, '')}/?sellos=${ids.join(',')}` : base;
}

/**
 * Sellos que trae la dirección, solo los que son paradas del recorrido.
 *
 * @param {string} search
 * @param {number[]} tour
 * @returns {number[]}
 */
export function parseStamps(search, tour) {
  const raw = new URLSearchParams(search).get('sellos') ?? '';
  const ids = raw.split(',').map(Number);
  return tour.filter((id) => ids.includes(id));
}

/**
 * Parte un nombre en renglones cortos para que quepa dentro de un sello.
 *
 * @param {string} text
 * @param {number} max caracteres por renglón
 * @returns {string[]}
 */
export function wrapWords(text, max) {
  const lines = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= max)
      lines[lines.length - 1] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

function drawStamp(ctx, { name, earned }, index, x, y, radius) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((earned ? TILTS[index % TILTS.length] : 0) * Math.PI) / 180);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (earned) {
    ctx.fillStyle = 'rgba(141, 198, 63, 0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3f6f12';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 14, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#b6c4d0';
    ctx.lineWidth = 5;
    ctx.setLineDash([16, 14]);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = earned ? '#3f6f12' : '#b6c4d0';
  ctx.font = `800 ${radius * 0.5}px ${DISPLAY}`;
  ctx.fillText(earned ? String(index + 1) : '?', 0, -radius * 0.34);
  const lines = wrapWords(name.toUpperCase(), 15).slice(0, 3);
  ctx.font = `700 ${radius * 0.15}px ${BODY}`;
  lines.forEach((line, row) => ctx.fillText(line, 0, radius * (0.12 + row * 0.19)));
  ctx.restore();
}

/**
 * Dibuja la postal del recorrido: título, un sello por parada (timbrado si se
 * ganó), Quibar y la fecha de la visita.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ stamps: Array<{ name: string, earned: boolean }>, title: string, count: string,
 *   place: string, date: string, quibar?: CanvasImageSource | null }} data
 */
export function drawPostcard(ctx, { stamps, title, count, place, date, quibar = null }) {
  const { width, height } = POSTCARD;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#1c75bc');
  sky.addColorStop(1, '#0d2438');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  /* Tarjeta clara con borde punteado, como una estampilla. */
  ctx.fillStyle = '#f3f9ff';
  ctx.beginPath();
  ctx.roundRect(50, 50, width - 100, height - 100, 56);
  ctx.fill();
  ctx.strokeStyle = '#cfdeeb';
  ctx.lineWidth = 4;
  ctx.setLineDash([4, 16]);
  ctx.beginPath();
  ctx.roundRect(78, 78, width - 156, height - 156, 40);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#1c75bc';
  ctx.font = `700 34px ${BODY}`;
  ctx.fillText(place.toUpperCase(), width / 2, 170);
  ctx.fillStyle = '#14334d';
  ctx.font = `800 84px ${DISPLAY}`;
  wrapWords(title, 20)
    .slice(0, 2)
    .forEach((line, row) => ctx.fillText(line, width / 2, 270 + row * 88));

  /* Sellos en dos columnas. */
  const radius = 150;
  const rows = Math.ceil(stamps.length / 2);
  stamps.forEach((stamp, index) => {
    const lonely = index === stamps.length - 1 && stamps.length % 2 === 1;
    const x = lonely ? width / 2 : width / 2 + (index % 2 === 0 ? -190 : 190);
    const y = 560 + Math.floor(index / 2) * 330 - (rows > 2 ? 60 : 0);
    drawStamp(ctx, stamp, index, x, y, rows > 2 ? 120 : radius);
    ctx.setLineDash([]);
  });

  if (quibar) {
    const frame = quibar.width / RUN_FRAMES;
    ctx.drawImage(quibar, 0, 0, frame, quibar.height, width - 330, height - 380, 270, 270);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#14334d';
  ctx.font = `800 52px ${DISPLAY}`;
  ctx.fillText(count, 130, height - 210);
  ctx.fillStyle = '#494c4e';
  ctx.font = `400 34px ${BODY}`;
  ctx.fillText(date, 130, height - 155);
  ctx.fillStyle = '#1c75bc';
  ctx.font = `800 40px ${DISPLAY}`;
  ctx.fillText('BioMap', 130, height - 105);
}

const loadImage = (src) =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    /* Sin Quibar la postal igual sirve. */
    image.onerror = () => resolve(null);
    image.src = src;
  });

/**
 * La postal como imagen PNG lista para guardar.
 *
 * @param {Omit<Parameters<typeof drawPostcard>[1], 'quibar'>} data
 * @returns {Promise<Blob>}
 */
export async function postcardBlob(data) {
  const canvas = document.createElement('canvas');
  canvas.width = POSTCARD.width;
  canvas.height = POSTCARD.height;
  const [quibar] = await Promise.all([
    loadImage(quibarRun),
    document.fonts?.load(`800 84px ${DISPLAY}`).catch(() => {}),
    document.fonts?.load(`700 34px ${BODY}`).catch(() => {}),
  ]);
  drawPostcard(canvas.getContext('2d'), { ...data, quibar });
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('postcard'))), 'image/png'),
  );
}
