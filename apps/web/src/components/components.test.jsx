import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AttractOverlay from '../features/attract/AttractOverlay.jsx';
import PointSheet from '../features/point/PointSheet.jsx';
import i18n from '../i18n/index.js';
import { useUserStore } from '../store/userStore.js';
import { useViewsStore } from '../store/viewsStore.js';
import { axeViolations } from '../test/axe.js';
import { clearTestQueryClients, makeWrapper } from '../test/providers.jsx';
import Compass from './Compass.jsx';
import Dock from './Dock.jsx';
import EpochPanel from './EpochPanel.jsx';
import InactivityWarning from './InactivityWarning.jsx';
import MobilePanel from './MobilePanel.jsx';
import SearchBar from './SearchBar.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import StatusPill from './StatusPill.jsx';

/* La mascota 3D necesita WebGL, que jsdom no tiene. */
vi.mock('../features/avatar/SheetMascot.jsx', () => ({ Mascot: () => null }));
vi.mock('@react-three/fiber', async (original) => ({ ...(await original()), Canvas: () => null }));

afterEach(() => {
  clearTestQueryClients();
  useUserStore.setState({ tour: [], visitedPoints: [] });
  return i18n.changeLanguage('es');
});

const TOURISM = { id: 3, slug: 'tourism', name: 'Turismo', color: '#1d4ed8' };
const VIEW = { center: [-71.83, -37.68], range: 30_000, heading: 0, pitch: -30 };

describe('Dock', () => {
  const renderDock = (props = {}) => {
    const handlers = {
      onHome: vi.fn(),
      onPanel: vi.fn(),
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
    };
    const view = render(<Dock panel={null} epochLabel="Hoy" {...handlers} {...props} />);
    return { ...view, ...handlers };
  };

  it('calls each control and shows the tour progress', () => {
    useUserStore.setState({ tour: [1, 2, 3, 4], visitedPoints: [1] });
    const { onHome, onPanel, onZoomIn, onZoomOut } = renderDock();
    fireEvent.click(screen.getByRole('button', { name: /Inicio/ }));
    fireEvent.click(screen.getByRole('button', { name: /BioMap Mobile/ }));
    fireEvent.click(screen.getByRole('button', { name: /Época/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alejar' }));
    fireEvent.click(screen.getByRole('button', { name: /Ajustes/ }));
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onPanel.mock.calls.map(([name]) => name)).toEqual(['mobile', 'epoch', 'settings']);
    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    const progress = screen.getByRole('progressbar', { name: 'Tu recorrido' });
    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    expect(progress.textContent).toContain('1/4');
  });

  it('marks the open panel and has no accessibility violations', async () => {
    const { container } = renderDock({ panel: 'settings' });
    expect(screen.getByRole('button', { name: /Ajustes/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: /Época/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it('hides the progress when the data defines no tour', () => {
    renderDock();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('SearchBar', () => {
  const POINTS = [
    { properties: { id: 1, name: 'Playa Quilaco' } },
    { properties: { id: 2, name: 'Camping Los Notros' } },
    { properties: { id: 3, name: 'Parque Angostura' } },
  ];

  it('filters places ignoring accents and capitals, and picks one', () => {
    const onPick = vi.fn();
    render(<SearchBar points={POINTS} onPick={onPick} />);
    const input = screen.getByRole('textbox', { name: 'Buscar un lugar' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'PLAYA' } });
    expect(screen.queryByRole('button', { name: /Camping/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Playa Quilaco/ }));
    expect(onPick).toHaveBeenCalledWith(1);
    expect(input.value).toBe('');
  });

  it('says so when nothing matches', () => {
    render(<SearchBar points={POINTS} onPick={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: 'Buscar un lugar' });
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText('Sin resultados')).toBeTruthy();
  });
});

describe('SettingsPanel', () => {
  const renderPanel = (props = {}) => {
    const handlers = {
      onLang: vi.fn(),
      onTextScale: vi.fn(),
      onContrast: vi.fn(),
      onPitch: vi.fn(),
      onContours: vi.fn(),
      onClose: vi.fn(),
    };
    const view = render(
      <SettingsPanel
        lang="es"
        textScale={0}
        contrast={false}
        pitched
        contours={false}
        {...handlers}
        {...props}
      />,
    );
    return { ...view, ...handlers };
  };

  it('offers language, text size, contrast and view, and shows the credits', () => {
    const { onLang, onTextScale, onContrast, onPitch, onContours, onClose } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tamaño de texto 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    fireEvent.click(screen.getByRole('button', { name: 'Plana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Curvas de nivel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onLang).toHaveBeenCalledWith('en');
    expect(onTextScale).toHaveBeenCalledWith(2);
    expect(onContrast).toHaveBeenCalledWith(true);
    expect(onPitch).toHaveBeenCalledTimes(1);
    expect(onContours).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Sentinel-2 cloudless 2016 de EOX \(CC BY 4.0/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Español' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = renderPanel();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('EpochPanel', () => {
  it('switches between the year 2000 and today, and explains the reconstruction', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <EpochPanel drained={false} onChange={onChange} onClose={vi.fn()} />,
    );
    expect(screen.queryByText(/Reconstrucción ilustrativa/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /2000/ }));
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<EpochPanel drained onChange={onChange} onClose={vi.fn()} />);
    expect(screen.getByText(/Reconstrucción ilustrativa/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /2000/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Hoy/ }));
    expect(onChange).toHaveBeenCalledWith(false);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('MobilePanel', () => {
  it('shows a local QR code and the Wi-Fi network, and closes', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <MobilePanel url="http://biomap.local" wifi="BioMap-Angostura" onClose={onClose} />,
    );
    const panel = screen.getByRole('dialog', { name: 'Llévate el mapa en tu celular' });
    const code = within(panel).getByRole('img', { name: /Código QR/ });
    await waitFor(() => expect(code.querySelector('svg')).not.toBeNull());
    expect(within(panel).getByText(/BioMap-Angostura/)).toBeTruthy();
    expect(await axeViolations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('points the code at the open place', async () => {
    const feature = { properties: { id: 7, name: 'Playa Quilaco' } };
    render(<MobilePanel url="http://biomap.local" selectedPoint={feature} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Lleva este lugar contigo' })).toBeTruthy();
    expect(screen.getByText('biomap.local/?point=7')).toBeTruthy();
  });
});

describe('Compass', () => {
  it('turns against the overview heading and resets north on tap', () => {
    useViewsStore.setState({ main: { ...VIEW, heading: 30 } });
    const onResetNorth = vi.fn();
    render(<Compass onResetNorth={onResetNorth} />);
    const button = screen.getByRole('button', { name: /Brújula/ });
    expect(button.querySelector('svg').style.transform).toBe('rotate(-30deg)');
    fireEvent.click(button);
    expect(onResetNorth).toHaveBeenCalled();
  });

  it('is hidden while the map has north up', () => {
    useViewsStore.setState({ main: VIEW });
    render(<Compass onResetNorth={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Brújula/ })).toBeNull();
  });
});

describe('StatusPill', () => {
  it('says the viewer is fully local when there are no problems', () => {
    render(<StatusPill messages={[]} />);
    expect(screen.getByRole('status').textContent).toBe('100 % local · sin internet');
  });

  it('shows every problem', () => {
    render(<StatusPill messages={['Uno', 'Dos']} />);
    expect(screen.getByRole('status').textContent).toBe('Uno · Dos');
  });
});

describe('InactivityWarning', () => {
  it('shows the countdown, keeps exploring or resets now', async () => {
    const onKeepExploring = vi.fn();
    const onResetNow = vi.fn();
    const { container } = render(
      <InactivityWarning
        secondsLeft={7}
        totalSeconds={10}
        onKeepExploring={onKeepExploring}
        onResetNow={onResetNow}
      />,
    );
    expect(screen.getByRole('alertdialog', { name: '¿Sigues explorando?' })).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir explorando' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar ahora' }));
    expect(onKeepExploring).toHaveBeenCalledTimes(1);
    expect(onResetNow).toHaveBeenCalledTimes(1);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('PointSheet', () => {
  const FEATURE = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-71.83, -37.68] },
    properties: { id: 7, name: 'Embalse Angostura', layerId: 3 },
  };

  it('shows the point, its description and its 360° tab, and closes', async () => {
    const loadPoint = async (id) => ({
      id,
      properties: {
        id,
        description: 'Lago artificial sobre el Biobío.',
        images: [{ kind: 'panorama', url: '/media/360.jpg' }],
      },
    });
    const onClose = vi.fn();
    const { container } = render(
      <PointSheet feature={FEATURE} layer={TOURISM} onClose={onClose} />,
      { wrapper: makeWrapper({ api: { loadPoint } }) },
    );
    expect(screen.getByRole('dialog', { name: 'Embalse Angostura' })).toBeTruthy();
    expect(screen.getByText('Turismo')).toBeTruthy();
    await screen.findByText('Lago artificial sobre el Biobío.');
    expect(screen.getByRole('tab', { name: 'Historia' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Fotos (0)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '360°' }));
    expect(screen.getByRole('tab', { name: '360°' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ficha de Embalse Angostura' }));
    expect(onClose).toHaveBeenCalled();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('AttractOverlay', () => {
  it('invites to explore and starts on tap', () => {
    const onExplore = vi.fn();
    render(<AttractOverlay stopName="Mirador del embalse" onExplore={onExplore} />);
    fireEvent.click(screen.getByRole('button', { name: /Toca para explorar/ }));
    expect(onExplore).toHaveBeenCalled();
  });
});
