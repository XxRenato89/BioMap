import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AttractOverlay from '../features/attract/AttractOverlay.jsx';
import PointSheet from '../features/point/PointSheet.jsx';
import i18n from '../i18n/index.js';
import { useViewsStore } from '../store/viewsStore.js';
import { axeViolations } from '../test/axe.js';
import { clearTestQueryClients, makeWrapper } from '../test/providers.jsx';
import AccessibilityBar from './AccessibilityBar.jsx';
import Compass from './Compass.jsx';
import HeaderCard from './HeaderCard.jsx';
import InactivityWarning from './InactivityWarning.jsx';
import LayerPanel from './LayerPanel.jsx';
import MapControls from './MapControls.jsx';
import QrCard from './QrCard.jsx';
import StatusPill from './StatusPill.jsx';
import ZoomLevels from './ZoomLevels.jsx';

afterEach(() => {
  clearTestQueryClients();
  return i18n.changeLanguage('es');
});

const HISTORY = { id: 1, slug: 'history', name: 'Historia', color: '#b4440e' };
const TOURISM = { id: 3, slug: 'tourism', name: 'Turismo', color: '#1d4ed8' };
const LEVELS = { region: 95_000, zone: 30_000, detail: 7_000 };
const VIEW = { center: [-71.83, -37.68], range: 30_000, heading: 0, pitch: -30 };

describe('LayerPanel', () => {
  const renderPanel = (onToggle = vi.fn()) =>
    render(
      <LayerPanel
        layers={[HISTORY, TOURISM]}
        visibleLayerIds={new Set([3])}
        counts={new Map([[3, 2]])}
        onToggle={onToggle}
      />,
    );

  it('reflects which layers are visible, shows counts and toggles on tap', () => {
    const onToggle = vi.fn();
    renderPanel(onToggle);
    const history = screen.getByRole('switch', { name: /Historia/ });
    const tourism = screen.getByRole('switch', { name: /Turismo/ });
    expect(history.getAttribute('aria-checked')).toBe('false');
    expect(tourism.getAttribute('aria-checked')).toBe('true');
    expect(history.textContent).toContain('0 puntos');
    expect(tourism.textContent).toContain('2 puntos');
    fireEvent.click(history);
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it('translates known layer names to English', async () => {
    await i18n.changeLanguage('en');
    renderPanel();
    expect(screen.getByRole('switch', { name: /History/ }).textContent).toContain('0 places');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderPanel();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('MapControls', () => {
  it('calls each control callback and reflects the 3D state', () => {
    const props = {
      onZoomIn: vi.fn(),
      onZoomOut: vi.fn(),
      onTogglePitch: vi.fn(),
      onToggleContours: vi.fn(),
      onReset: vi.fn(),
    };
    render(<MapControls pitched contours={false} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Curvas de nivel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alejar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vista inclinada en 3D' }));
    fireEvent.click(screen.getByRole('button', { name: /Reiniciar vista/ }));
    expect(props.onZoomIn).toHaveBeenCalledTimes(1);
    expect(props.onZoomOut).toHaveBeenCalledTimes(1);
    expect(props.onTogglePitch).toHaveBeenCalledTimes(1);
    expect(props.onReset).toHaveBeenCalledTimes(1);
    expect(props.onToggleContours).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Curvas de nivel' }).getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      screen.getByRole('button', { name: 'Vista inclinada en 3D' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });
});

describe('ZoomLevels', () => {
  it('marks the active level and jumps to a level on tap', () => {
    useViewsStore.setState({ main: VIEW });
    const onPick = vi.fn();
    render(<ZoomLevels levels={LEVELS} onPick={onPick} restSeconds={45} />);
    expect(screen.getByText(/tras 45 s sin uso/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Zona/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Detalle/ }));
    expect(onPick).toHaveBeenCalledWith(7_000);
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
});

describe('AccessibilityBar', () => {
  it('offers larger text, contrast and language', () => {
    const props = { onTextScale: vi.fn(), onContrast: vi.fn(), onLanguage: vi.fn() };
    render(<AccessibilityBar textScale={0} contrast {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Texto más grande' }));
    fireEvent.click(screen.getByRole('button', { name: /Contraste/ }));
    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    expect(props.onTextScale).toHaveBeenCalled();
    expect(props.onContrast).toHaveBeenCalled();
    expect(props.onLanguage).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Contraste/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
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

describe('QrCard', () => {
  it('generates the QR code locally and names the Wi-Fi network', async () => {
    render(<QrCard url="http://biomap.local" wifi="BioMap-Angostura" />);
    const code = screen.getByRole('img', { name: /Código QR/ });
    await waitFor(() => expect(code.querySelector('svg')).not.toBeNull());
    expect(screen.getByText('BioMap-Angostura').tagName).toBe('STRONG');
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
    expect(screen.getByRole('button', { name: '360°' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Fotos \(0\)/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ficha de Embalse Angostura' }));
    expect(onClose).toHaveBeenCalled();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('HeaderCard and AttractOverlay', () => {
  it('shows the title and the invitation to explore', () => {
    const onExplore = vi.fn();
    render(
      <>
        <HeaderCard />
        <AttractOverlay stopName="Mirador del embalse" onExplore={onExplore} />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'BioMap' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Toca para explorar/ }));
    expect(onExplore).toHaveBeenCalled();
  });
});
