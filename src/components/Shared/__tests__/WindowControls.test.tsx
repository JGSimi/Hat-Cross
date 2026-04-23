import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import WindowControls from '../WindowControls';

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    close: vi.fn(),
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

const platformMock = vi.hoisted(() => ({ value: 'macos' as 'macos' | 'windows' | 'linux' }));

vi.mock('../../../hooks/usePlatform', () => ({
  usePlatform: () => platformMock.value,
}));

describe('WindowControls', () => {
  beforeEach(() => {
    platformMock.value = 'macos';
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
