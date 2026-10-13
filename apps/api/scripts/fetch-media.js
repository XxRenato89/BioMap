import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * CLI: descarga a MEDIA_DIR las fotos de ejemplo con licencia abierta
 * (Wikimedia Commons, CC BY-SA) que usan las semillas. Cada ficha muestra
 * su crédito, como exige la licencia (ver docs/referencias.md). Las que ya
 * están no se vuelven a bajar.
 */
const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons';
const PHOTOS = {
  'presa-construccion-1.jpg': `${COMMONS}/5/5e/Construcci%C3%B3n_Presa_Angostura_-_panoramio.jpg`,
  'presa-construccion-2.jpg': `${COMMONS}/c/c0/Construcci%C3%B3n_Presa_Angostura_-_panoramio_%281%29.jpg`,
  'presa-construccion-3.jpg': `${COMMONS}/1/1f/Construcci%C3%B3n_Presa_Angostura_-_panoramio_%282%29.jpg`,
  'camping-trompelhueno.jpg': `${COMMONS}/5/52/Tropelhueno.jpg`,
  'arboreto-quilaco.jpg': `${COMMONS}/b/b3/Arboretum_Quilaco.jpg`,
  'biobio-desde-puente-quilaco.jpg': `${COMMONS}/thumb/b/b2/Rio_bio_bio_desde_puente_quilaco.jpg/1920px-Rio_bio_bio_desde_puente_quilaco.jpg`,
};
/* Wikimedia pide identificarse y limita la frecuencia: un archivo cada pocos segundos. */
const HEADERS = { 'User-Agent': 'BioMap/1.0 (kiosco Centro de Visitantes Angostura)' };
const PAUSE_MS = 3000;
const TRIES = 4;

const mediaDir = path.resolve(
  process.env.MEDIA_DIR ?? path.join(import.meta.dirname, '../../../media'),
);
mkdirSync(mediaDir, { recursive: true });

let failed = 0;
for (const [file, url] of Object.entries(PHOTOS)) {
  const target = path.join(mediaDir, file);
  if (existsSync(target)) {
    console.log(`ya está: ${file}`);
    continue;
  }
  let saved = false;
  for (let attempt = 1; attempt <= TRIES && !saved; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS * attempt));
    const response = await fetch(url, { headers: HEADERS }).catch(() => null);
    if (response?.ok && response.headers.get('content-type')?.startsWith('image/')) {
      writeFileSync(target, Buffer.from(await response.arrayBuffer()));
      saved = true;
    }
  }
  console.log(saved ? `descargada: ${file}` : `no se pudo descargar: ${file}`);
  if (!saved) failed += 1;
}
process.exit(failed > 0 ? 1 : 0);
