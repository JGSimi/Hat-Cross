import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import WindowControls from '../WindowControls';

const windowMocks = vi.hoisted(() => ({
  close: vi.fn(),
  destroy: vi.fn(),
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  exit: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    close: windowMocks.close,
    destroy: windowMocks.destroy,
    minimize: windowMocks.minimize,
    toggleMaximize: windowMocks.toggleMaximize,
  }),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  exit: windowMocks.exit,
}));

const platformMock = vi.hoisted(() => ({ value: 'macos' as 'macos' | 'windows' | 'linux' }));

vi.mock('../../../hooks/usePlatform', () => ({
  usePlatform: () => platformMock.value,
}));

describe('WindowControls', () => {
  beforeEach(() => {
    platformMock.value = 'macos';
    windowMocks.close.mockClear();
    windowMocks.destroy.mockClear();
    windowMocks.minimize.mockClear();
    windowMocks.toggleMaximize.mockClear();
    windowMocks.exit.mockClear();
  });

  it('renders the 3 mac traffic-light controls on macos sidebar', () => {
    render(<WindowControls variant="sidebar" />);
    expect(
      screen.getByRole('button', { name: 'Fechar janela' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Minimizar janela' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Maximizar janela' }),
    ).toBeInTheDocument();
  });

  it('renders nothing in header variant on macos', () => {
    const { container } = render(<WindowControls variant="header" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders minimal controls in header variant on windows', () => {
    platformMock.value = 'windows';
    render(<WindowControls variant="header" />);
    expect(
      screen.getByRole('button', { name: 'Minimizar janela' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Maximizar janela' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Fechar janela' }),
    ).toBeInTheDocument();
  });

  it('wires windows controls to Tauri window methods and quits on close', async () => {
    const user = userEvent.setup();
    platformMock.value = 'windows';
    render(<WindowControls variant="header" />);

    await user.click(screen.getByRole('button', { name: 'Minimizar janela' }));
    await user.click(screen.getByRole('button', { name: 'Maximizar janela' }));
    await user.click(screen.getByRole('button', { name: 'Fechar janela' }));

    expect(windowMocks.minimize).toHaveBeenCalledTimes(1);
    expect(windowMocks.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(windowMocks.exit).toHaveBeenCalledWith(0);
    expect(windowMocks.close).not.toHaveBeenCalled();
    expect(windowMocks.destroy).not.toHaveBeenCalled();
  });

  it('quits instead of closing on macos', async () => {
    const user = userEvent.setup();
    platformMock.value = 'macos';
    render(<WindowControls variant="sidebar" />);

    await user.click(screen.getByRole('button', { name: 'Fechar janela' }));

    expect(windowMocks.exit).toHaveBeenCalledWith(0);
    expect(windowMocks.close).not.toHaveBeenCalled();
    expect(windowMocks.destroy).not.toHaveBeenCalled();
  });

  it('quits instead of closing on linux', async () => {
    const user = userEvent.setup();
    platformMock.value = 'linux';
    render(<WindowControls variant="header" />);

    await user.click(screen.getByRole('button', { name: 'Fechar janela' }));

    expect(windowMocks.exit).toHaveBeenCalledWith(0);
    expect(windowMocks.close).not.toHaveBeenCalled();
    expect(windowMocks.destroy).not.toHaveBeenCalled();
  });

  it('passes axe (macos sidebar)', async () => {
    const { container } = render(<WindowControls variant="sidebar" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe (windows header)', async () => {
    platformMock.value = 'windows';
    const { container } = render(<WindowControls variant="header" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
