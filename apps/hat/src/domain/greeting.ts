// Saudação humana por hora do dia + primeiro nome. Puro e testável.

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Primeiro nome a partir do displayName; cai para o prefixo do email. */
export function firstNameOf(
  displayName: string | null,
  email: string | null,
): string {
  const fromName = displayName?.trim().split(/\s+/)[0];
  if (fromName) return capitalize(fromName);
  const fromEmail = email?.split('@')[0]?.split(/[._-]/)[0];
  if (fromEmail) return capitalize(fromEmail);
  return '';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
