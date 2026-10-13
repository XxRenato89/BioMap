import { describe, expect, it } from 'vitest';
import { Group } from 'three';
import {
  BUILDERS,
  buildDam,
  createPoiModel,
  modelKindFor,
  modelScale,
  MODEL_SCALE_MULTIPLIER,
} from './index.js';

describe('diorama/models', () => {
  describe('modelKindFor', () => {
    it('tells dams from power plants, and the reservoir is neither', () => {
      expect(modelKindFor('Presa Angostura')).toBe('dam');
      expect(modelKindFor('Represa Ralco')).toBe('dam');
      expect(modelKindFor('Central Hidroeléctrica Angostura')).toBe('powerhouse');
      expect(modelKindFor('Embalse Angostura')).toBeNull();
    });

    it('detects the real Angostura places', () => {
      expect(modelKindFor('Playa Pública Quilaco')).toBe('beach');
      expect(modelKindFor('Mirador del Embalse y Presa')).toBe('lookout');
      expect(modelKindFor('Informaciones Turísticas')).toBe('info');
      expect(modelKindFor('Arboreto')).toBe('arboretum');
      expect(modelKindFor('Parque Angostura y Sendero Huequecura')).toBe('trailhead');
      expect(modelKindFor('Camping Los Notros')).toBe('camping');
    });

    it('detects cultural and nature landmarks', () => {
      expect(modelKindFor('Puente Colgante Bío Bío')).toBe('bridge');
      expect(modelKindFor('Ruka Pehuenche')).toBe('ruka');
      expect(modelKindFor('Bosque de Araucarias')).toBe('araucaria');
      expect(modelKindFor('Sendero de las Lengas')).toBe('lenga');
      expect(modelKindFor('Humedal y Aves')).toBe('wetland');
      expect(modelKindFor('Centro de Visitantes')).toBe('visitors');
      expect(modelKindFor('Mirador del Valle')).toBe('lookout');
      expect(modelKindFor('Zona de Camping')).toBe('camping');
    });

    it('returns null for unmatched POI names', () => {
      expect(modelKindFor('Restaurante El Rincón')).toBeNull();
    });
  });

  describe('modelScale', () => {
    it('scales dam correctly to km units with magnification', () => {
      expect(modelScale('dam')).toBeCloseTo((30 * MODEL_SCALE_MULTIPLIER) / 1000, 6);
    });

    it('returns default fallback scale for unknown kinds', () => {
      expect(modelScale('unknown')).toBeCloseTo(0.01, 4);
    });
  });

  describe('buildDam', () => {
    it('builds a Three.js Group with dam meshes', () => {
      const dam = buildDam();
      expect(dam).toBeInstanceOf(Group);
      expect(dam.children.length).toBeGreaterThan(5);
    });
  });

  describe('createPoiModel', () => {
    it('creates cloned instances of each model kind', () => {
      for (const kind of Object.keys(BUILDERS)) {
        const model = createPoiModel(kind);
        expect(model).toBeInstanceOf(Group);
      }
    });

    it('returns null for non-existing kinds', () => {
      expect(createPoiModel('nonexistent')).toBeNull();
    });
  });
});
