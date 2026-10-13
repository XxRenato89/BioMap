import { describe, expect, it } from 'vitest';
import { DAMS, parseOverpass } from './osm.js';

const BOUNDS = [
  [-72.6, -38.1],
  [-71.2, -37.3],
];

const RESPONSE = {
  elements: [
    {
      type: 'way',
      id: 738577784,
      tags: { waterway: 'dam' },
      geometry: [
        { lat: -37.719, lon: -71.817 },
        { lat: -37.7195, lon: -71.815 },
      ],
    },
    {
      type: 'node',
      id: 1,
      lat: -37.41,
      lon: -71.35,
      tags: { natural: 'volcano', name: 'Volcán Antuco', ele: '2979' },
    },
    { type: 'node', id: 2, lat: -37.5, lon: -71.5, tags: { natural: 'peak', ele: '2500' } },
    {
      type: 'node',
      id: 3,
      lat: -37.6,
      lon: -71.6,
      tags: { natural: 'peak', name: 'Cerro Bajo', ele: '1200' },
    },
    {
      type: 'relation',
      id: 4,
      center: { lat: -37.75, lon: -71.85 },
      tags: { natural: 'water', water: 'reservoir', name: 'Embalse Angostura' },
    },
    {
      type: 'node',
      id: 5,
      lat: -37.6,
      lon: -72.0,
      tags: { place: 'town', name: 'Santa Bárbara' },
    },
    { type: 'node', id: 6, lat: -36.5, lon: -72.0, tags: { place: 'city', name: 'Chillán' } },
    {
      type: 'way',
      id: 7,
      tags: { highway: 'secondary', bridge: 'yes' },
      geometry: [
        { lat: -37.5, lon: -71.5 },
        { lat: -37.51, lon: -71.49 },
        { lat: -36.0, lon: -71.48 },
        { lat: -37.52, lon: -71.47 },
        { lat: -37.53, lon: -71.46 },
      ],
    },
    {
      type: 'way',
      id: 8,
      tags: { highway: 'footway' },
      geometry: [
        { lat: -37.5, lon: -71.5 },
        { lat: -37.6, lon: -71.6 },
      ],
    },
    {
      type: 'way',
      id: 9,
      tags: { building: 'yes', 'building:levels': '2' },
      geometry: [
        { lat: -37.5, lon: -71.5 },
        { lat: -37.5, lon: -71.499 },
        { lat: -37.501, lon: -71.499 },
        { lat: -37.5, lon: -71.5 },
      ],
    },
  ],
};

describe('parseOverpass', () => {
  const { dams, labels, roads, buildings } = parseOverpass(RESPONSE, BOUNDS);

  it('keeps roads and footpaths, split where they leave the bounds', () => {
    expect(roads.map((road) => [road.kind, road.line.length, road.bridge])).toEqual([
      ['secondary', 2, true],
      ['secondary', 2, true],
      ['footway', 2, undefined],
    ]);
  });

  it('keeps buildings with their height from the number of levels', () => {
    expect(buildings).toHaveLength(1);
    expect(buildings[0].height).toBe(6);
  });

  it('turns the dam ways into lines [lng, lat] with their name', () => {
    expect(dams).toEqual([
      {
        id: 738577784,
        name: DAMS[738577784],
        line: [
          [-71.817, -37.719],
          [-71.815, -37.7195],
        ],
      },
    ]);
  });

  it('keeps named landmarks inside the bounds with their kind and rank', () => {
    const byName = Object.fromEntries(labels.map((label) => [label.name, label]));
    expect(byName['Volcán Antuco']).toMatchObject({ kind: 'volcano', rank: 90 });
    expect(byName['Embalse Angostura']).toMatchObject({
      kind: 'reservoir',
      rank: 80,
      coordinates: [-71.85, -37.75],
    });
    expect(byName['Santa Bárbara']).toMatchObject({ kind: 'town', rank: 55 });
    expect(byName[DAMS[738577784]]).toMatchObject({ kind: 'dam', rank: 75 });
  });

  it('drops unnamed places, low peaks and places outside the bounds', () => {
    const names = labels.map((label) => label.name);
    expect(names).not.toContain('Cerro Bajo');
    expect(names).not.toContain('Chillán');
    expect(labels.every((label) => label.name)).toBe(true);
  });
});
