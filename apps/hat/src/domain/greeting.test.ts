import { describe, expect, it } from 'vitest';
import { firstNameOf, greetingFor } from './greeting';

describe('greetingFor', () => {
  it('mapeia as faixas do dia', () => {
    expect(greetingFor(5)).toBe('Bom dia');
    expect(greetingFor(11)).toBe('Bom dia');
    expect(greetingFor(12)).toBe('Boa tarde');
    expect(greetingFor(17)).toBe('Boa tarde');
    expect(greetingFor(18)).toBe('Boa noite');
    expect(greetingFor(23)).toBe('Boa noite');
    expect(greetingFor(3)).toBe('Boa noite');
  });
});

describe('firstNameOf', () => {
  it('usa o primeiro nome do displayName', () => {
    expect(firstNameOf('João Guilherme Simi', null)).toBe('João');
  });

  it('cai para o prefixo do email', () => {
    expect(firstNameOf(null, 'joao02simi@gmail.com')).toBe('Joao02simi');
    expect(firstNameOf('', 'maria.silva@x.com')).toBe('Maria');
  });

  it('vazio quando não há nada', () => {
    expect(firstNameOf(null, null)).toBe('');
  });
});
