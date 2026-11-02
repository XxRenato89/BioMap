import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n/index.js';
import { axeViolations } from '../test/axe.js';
import { clearTestQueryClients, makeWrapper } from '../test/providers.jsx';
import LayersSheet from './LayersSheet.jsx';
import PlaceSearch from './PlaceSearch.jsx';
import PlaceSheet from './PlaceSheet.jsx';

afterEach(() => {
  clearTestQueryClients();
  return i18n.changeLanguage('es');
});

const HISTORY = { id: 1, slug: 'history', name: 'Historia', color: '#b4440e' };
const TOURISM = { id: 3, slug: 'tourism', name: 'Turismo', color: '#1d4ed8' };
const feature = (id, name, coordinates = [-71.8, -37.7]) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates },
  properties: { id, name, layerId: 1 },
});

describe('LayersSheet', () => {
  it('shows each layer with its count and toggles it, accessibly', async () => {
    const onToggle = vi.fn();
    const { container } = render(
      <LayersSheet
        layers={[HISTORY, TOURISM]}
        hidden={new Set([3])}
        counts={new Map([[1, 5]])}
        onToggle={onToggle}
        onClose={vi.fn()}
      />,
    );
    const history = screen.getByRole('switch', { name: /Historia/ });
    const tourism = screen.getByRole('switch', { name: /Turismo/ });
    expect(history.getAttribute('aria-checked')).toBe('true');
    expect(tourism.getAttribute('aria-checked')).toBe('false');
    expect(history.textContent).toContain('5 puntos');
    expect(tourism.textContent).toContain('0 puntos');
    fireEvent.click(tourism);
    expect(onToggle).toHaveBeenCalledWith(3);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('PlaceSearch', () => {
  it('filters places ignoring accents and picks one', () => {
    const onPick = vi.fn();
    render(
      <PlaceSearch
        features={[feature(1, 'Playa Quilaco'), feature(2, 'Camping Los Notros')]}
        layers={new Map([[1, HISTORY]])}
        onPick={onPick}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'CAMPING' } });
    expect(screen.queryByRole('button', { name: /Playa/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Camping Los Notros/ }));
    expect(onPick).toHaveBeenCalledWith(2);
  });
});

describe('PlaceSheet', () => {
  const loadPoint = async (id) => ({
    id,
    properties: {
      id,
      description: 'Lago artificial sobre el Biobío.',
      images: [
        { kind: 'photo', url: '/media/a.jpg', credit: 'Autora, CC BY 4.0', altText: 'Vista' },
      ],
    },
  });

  it('shows the story, photo credit, tour step and moves to the next stop', async () => {
    const onNext = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <PlaceSheet
        feature={feature(7, 'Embalse Angostura')}
        layer={HISTORY}
        step={2}
        total={4}
        visited
        next={feature(8, 'Playa Quilaco')}
        onNext={onNext}
        onClose={onClose}
      />,
      { wrapper: makeWrapper({ api: { loadPoint } }) },
    );
    expect(screen.getByRole('dialog', { name: 'Embalse Angostura' })).toBeTruthy();
    expect(screen.getByText('Parada 2 de 4')).toBeTruthy();
    await screen.findByText('Lago artificial sobre el Biobío.');
    expect(screen.getByText(/Fotografía: Autora, CC BY 4.0/)).toBeTruthy();
    expect(screen.getByText('Visitado')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Seguir a Playa Quilaco/ }));
    expect(onNext).toHaveBeenCalledWith(8);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ficha de Embalse Angostura' }));
    expect(onClose).toHaveBeenCalled();
    expect(await axeViolations(container)).toEqual([]);
  });
});
