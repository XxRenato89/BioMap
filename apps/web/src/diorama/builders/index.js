export {
  buildDamWall,
  densify,
  DAM_CREST_WIDTH,
  DAM_SLOPE,
  DAM_FOOTING,
  CONCRETE,
  CONCRETE_SHADED,
  PARAPET,
  DAM_PARAPET,
} from './dam.js';

export { buildWater, WATER_LIFT } from './water.js';

export {
  plantForest,
  plantFringe,
  plantRocks,
  treeKind,
  plantationSpecies,
  isNativeLocation,
  TREE_HEIGHT,
  COVER_CHANCE,
} from './forest.js';

export { buildBuildings, ROOF, WALL, WALL_BASE } from './buildings.js';

export { bakeDetail } from './detail.js';

export { bakeSurface } from '../terrain/bake.js';
export { buildTerrainChunks } from '../terrain/lod.js';
