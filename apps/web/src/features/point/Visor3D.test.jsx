import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n/index.js';
import Visor3D from './Visor3D.jsx';

describe('Visor3D', () => {
  it('muestra el lugar y se cierra con el botón o con Escape', () => {
    const onExit = vi.fn();
    render(<Visor3D name="Los Notros" onExit={onExit} />);
    expect(screen.getByRole('dialog', { name: 'Los Notros' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledTimes(2);
  });
});
