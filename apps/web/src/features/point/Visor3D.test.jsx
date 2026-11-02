import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n/index.js';
import Visor3D from './Visor3D.jsx';

describe('Visor3D', () => {
  it('cambia de modo, gira y vuelve a la ficha', () => {
    const onKind = vi.fn();
    const onSpin = vi.fn();
    const onExit = vi.fn();
    render(
      <Visor3D
        name="Los Notros"
        kind="ground"
        spinning={false}
        onKind={onKind}
        onSpin={onSpin}
        onExit={onExit}
        onResetNorth={() => {}}
      />,
    );
    expect(screen.getByRole('radio', { name: /A pie/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: /Dron/ }));
    fireEvent.click(screen.getByRole('button', { name: /Girar 360/ }));
    fireEvent.click(screen.getByRole('button', { name: /Volver a la ficha/ }));
    expect(onKind).toHaveBeenCalledWith('drone');
    expect(onSpin).toHaveBeenCalled();
    expect(onExit).toHaveBeenCalled();
  });
});
