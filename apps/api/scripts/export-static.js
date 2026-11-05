import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createLayersMockRepository } from '../src/layers/layers.mock.js';
import { createPointsMockRepository } from '../src/points/points.mock.js';
import { withPublicImages } from '../src/points/points.routes.js';

/**
 * CLI: genera los datos estáticos del visor desde las semillas (única fuente).
 * - apps/web/public/mock/*.json: respaldo incluido en el build, para cuando no hay red.
 * - apps/web/public/api/*: las mismas respuestas de la API como archivos, con y
 *   sin .json (y points/index.json), para publicar el visor sin servidor (demo
 *   estática): cada servidor estático resuelve /api/points a uno de ellos.
 * No editar esos archivos a mano: correr `npm run export:static -w apps/api`.
 */
const WEB_PUBLIC = fileURLToPath(new URL('../../web/public/', import.meta.url));
const MEDIA_BASE_URL = '/media';

const layers = await createLayersMockRepository().findActive();
const pointsRepository = createPointsMockRepository();
const points = { type: 'FeatureCollection', features: await pointsRepository.findAll() };
const details = {};
for (const feature of points.features) {
  details[feature.id] = withPublicImages(
    await pointsRepository.findById(feature.id),
    MEDIA_BASE_URL,
  );
}

const write = (path, data) =>
  writeFileSync(WEB_PUBLIC + path, `${JSON.stringify(data, null, 2)}\n`);

rmSync(WEB_PUBLIC + 'api', { recursive: true, force: true });
mkdirSync(WEB_PUBLIC + 'api/points', { recursive: true });
mkdirSync(WEB_PUBLIC + 'mock', { recursive: true });
write('mock/layers.json', layers);
write('mock/points.json', points);
write('mock/points-detail.json', details);
for (const path of ['api/layers', 'api/layers.json']) write(path, layers);
for (const path of ['api/points.json', 'api/points/index.json']) write(path, points);
for (const [id, detail] of Object.entries(details)) {
  write(`api/points/${id}`, detail);
  write(`api/points/${id}.json`, detail);
}

console.log(`Static data: ${layers.length} layers, ${points.features.length} points`);
